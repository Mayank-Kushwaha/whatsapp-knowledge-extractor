"""Topic clustering service using HDBSCAN or K-Means.

Groups messages into semantic clusters based on their embeddings.
"""

import json
import logging
from typing import Optional

import numpy as np
from sklearn.cluster import KMeans
from sqlalchemy.orm import Session

try:
    import hdbscan
    HDBSCAN_AVAILABLE = True
except ImportError:
    HDBSCAN_AVAILABLE = False
    logging.warning("hdbscan not available, will use K-Means only")

from app.models.db import Cluster, Message
from app.services.embedder import get_embedding_matrix

logger = logging.getLogger(__name__)


def cluster_messages(
    db: Session,
    chat_id: int,
    min_cluster_size: int = 10,
    max_clusters: int = 20,
) -> int:
    """Cluster messages in a chat based on their embeddings.
    
    Args:
        db: Database session
        chat_id: Chat ID to process
        min_cluster_size: Minimum messages per cluster (for HDBSCAN)
        max_clusters: Maximum number of clusters (for K-Means)
        
    Returns:
        Number of clusters created
    """
    logger.info(f"[Clusterer] Chat {chat_id}: Starting clustering")
    
    # Load embeddings
    embedding_matrix, message_ids = get_embedding_matrix(db, chat_id)
    
    if len(message_ids) < 20:
        logger.info(f"[Clusterer] Chat {chat_id}: Too few messages ({len(message_ids)}) for clustering")
        return 0
    
    logger.info(f"[Clusterer] Chat {chat_id}: Loaded {len(message_ids)} embeddings")
    
    # Try HDBSCAN first
    cluster_labels = None
    method = None
    
    if HDBSCAN_AVAILABLE:
        try:
            logger.info(f"[Clusterer] Chat {chat_id}: Trying HDBSCAN (min_cluster_size={min_cluster_size})")
            clusterer = hdbscan.HDBSCAN(
                min_cluster_size=min_cluster_size,
                min_samples=5,
                metric='euclidean',
                cluster_selection_method='eom',
            )
            cluster_labels = clusterer.fit_predict(embedding_matrix)
            
            # Check if HDBSCAN produced reasonable clusters
            n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
            n_noise = list(cluster_labels).count(-1)
            
            if n_clusters >= 2 and n_noise < len(message_ids) * 0.5:
                method = "HDBSCAN"
                logger.info(f"[Clusterer] Chat {chat_id}: HDBSCAN produced {n_clusters} clusters ({n_noise} noise points)")
            else:
                logger.info(f"[Clusterer] Chat {chat_id}: HDBSCAN produced too few clusters or too much noise, falling back to K-Means")
                cluster_labels = None
        except Exception as e:
            logger.warning(f"[Clusterer] Chat {chat_id}: HDBSCAN failed: {e}, falling back to K-Means")
            cluster_labels = None
    
    # Fallback to K-Means
    if cluster_labels is None:
        # Determine optimal K using elbow method (simplified)
        n_messages = len(message_ids)
        k = min(max(3, n_messages // 50), max_clusters)  # Heuristic: 1 cluster per 50 messages
        
        logger.info(f"[Clusterer] Chat {chat_id}: Using K-Means with k={k}")
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(embedding_matrix)
        method = "K-Means"
    
    # Assign cluster IDs to messages and create cluster rows
    unique_labels = set(cluster_labels)
    if -1 in unique_labels:
        unique_labels.remove(-1)  # Remove noise label
    
    cluster_id_map = {}  # label → cluster.id
    
    for label in sorted(unique_labels):
        # Get messages in this cluster
        indices = [i for i, l in enumerate(cluster_labels) if l == label]
        msg_ids_in_cluster = [message_ids[i] for i in indices]
        
        # Compute centroid embedding
        cluster_embeddings = embedding_matrix[indices]
        centroid = np.mean(cluster_embeddings, axis=0)
        
        # Create cluster row
        cluster = Cluster(
            chat_id=chat_id,
            label=None,  # Will be filled by LLM in Step 7
            summary=None,
            message_count=len(msg_ids_in_cluster),
            centroid_embedding=json.dumps(centroid.tolist()),
        )
        db.add(cluster)
        db.flush()
        
        cluster_id_map[label] = cluster.id
    
    db.commit()
    
    # Assign cluster_id to messages
    for i, label in enumerate(cluster_labels):
        if label == -1:
            continue  # Skip noise points
        
        msg_id = message_ids[i]
        cluster_id = cluster_id_map[label]
        
        msg = db.query(Message).filter(Message.id == msg_id).first()
        if msg:
            msg.cluster_id = cluster_id
    
    db.commit()
    
    n_clusters = len(cluster_id_map)
    logger.info(f"[Clusterer] Chat {chat_id}: ✅ Created {n_clusters} clusters using {method}")
    return n_clusters