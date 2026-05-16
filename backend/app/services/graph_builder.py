"""Graph data builder — computes nodes and edges for the knowledge graph.

Creates an aggregated graph with sender nodes, cluster/topic nodes,
domain nodes, and important message nodes connected by relationship edges.
"""

import logging
from collections import defaultdict
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.db import Chat, Cluster, Link, Message, Sender

logger = logging.getLogger(__name__)

# Node type colors (hex)
NODE_COLORS = {
    "sender": "#10b981",     # Emerald green
    "cluster": "#3b82f6",    # Blue
    "domain": "#8b5cf6",     # Purple
    "important": "#f59e0b",  # Amber
}


def build_graph_data(
    db: Session,
    chat_id: int,
    max_nodes: int = 500,
    filter_type: Optional[str] = None,
    filter_sender: Optional[str] = None,
    filter_cluster: Optional[int] = None,
) -> dict:
    """Build graph nodes and edges for a chat.
    
    Args:
        db: Database session
        chat_id: Chat ID
        max_nodes: Maximum total nodes (default 500)
        filter_type: Optional filter by node type
        filter_sender: Optional filter by sender name
        filter_cluster: Optional filter by cluster ID
        
    Returns:
        Dict with 'nodes' and 'edges' lists
    """
    nodes = []
    edges = []
    node_ids = set()
    
    # --- Sender nodes ---
    senders = db.query(Sender).filter(Sender.chat_id == chat_id).all()
    sender_msg_counts = {}
    for sender in senders:
        count = db.query(func.count(Message.id)).filter(
            Message.sender_id == sender.id
        ).scalar() or 0
        sender_msg_counts[sender.id] = count
    
    # Sort by message count, take top senders
    top_senders = sorted(senders, key=lambda s: sender_msg_counts.get(s.id, 0), reverse=True)
    max_senders = min(len(top_senders), max_nodes // 4)
    
    if not filter_type or filter_type == "sender":
        for sender in top_senders[:max_senders]:
            if filter_sender and filter_sender.lower() not in sender.display_name.lower():
                continue
            nid = f"sender-{sender.id}"
            nodes.append({
                "id": nid,
                "label": sender.display_name,
                "type": "sender",
                "size": min(sender_msg_counts.get(sender.id, 1), 100),
                "color": NODE_COLORS["sender"],
                "metadata": {
                    "sender_id": sender.id,
                    "message_count": sender_msg_counts.get(sender.id, 0),
                },
            })
            node_ids.add(nid)
    
    # --- Cluster/Topic nodes ---
    clusters = db.query(Cluster).filter(Cluster.chat_id == chat_id).all()
    
    if not filter_type or filter_type == "cluster":
        for cluster in clusters:
            if filter_cluster and cluster.id != filter_cluster:
                continue
            nid = f"cluster-{cluster.id}"
            nodes.append({
                "id": nid,
                "label": cluster.label or f"Topic {cluster.id}",
                "type": "cluster",
                "size": min(cluster.message_count, 80),
                "color": NODE_COLORS["cluster"],
                "metadata": {
                    "cluster_id": cluster.id,
                    "summary": cluster.summary,
                    "message_count": cluster.message_count,
                },
            })
            node_ids.add(nid)
    
    # --- Domain nodes ---
    domain_counts = db.query(
        Link.domain, func.count(Link.id)
    ).join(Message, Message.id == Link.message_id).filter(
        Message.chat_id == chat_id,
        Link.domain.isnot(None),
    ).group_by(Link.domain).all()
    
    top_domains = sorted(domain_counts, key=lambda d: d[1], reverse=True)
    max_domains = min(len(top_domains), max_nodes // 4)
    
    if not filter_type or filter_type == "domain":
        for domain, count in top_domains[:max_domains]:
            if not domain:
                continue
            nid = f"domain-{domain}"
            nodes.append({
                "id": nid,
                "label": domain,
                "type": "domain",
                "size": min(count * 3, 60),
                "color": NODE_COLORS["domain"],
                "metadata": {
                    "domain": domain,
                    "link_count": count,
                },
            })
            node_ids.add(nid)
    
    # --- Important message nodes (top 50) ---
    if not filter_type or filter_type == "important":
        important_msgs = db.query(Message).filter(
            Message.chat_id == chat_id,
            Message.is_important == True,
        ).order_by(Message.timestamp.desc()).limit(50).all()
        
        for msg in important_msgs:
            nid = f"important-{msg.id}"
            nodes.append({
                "id": nid,
                "label": (msg.content or "")[:60] + ("..." if len(msg.content or "") > 60 else ""),
                "type": "important",
                "size": 20,
                "color": NODE_COLORS["important"],
                "metadata": {
                    "message_id": msg.id,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                    "sender_id": msg.sender_id,
                },
            })
            node_ids.add(nid)
    
    # --- Edges: sender → cluster (participates in topic) ---
    for sender in top_senders[:max_senders]:
        sender_nid = f"sender-{sender.id}"
        if sender_nid not in node_ids:
            continue
        
        # Find which clusters this sender has messages in
        sender_clusters = db.query(
            Message.cluster_id, func.count(Message.id)
        ).filter(
            Message.sender_id == sender.id,
            Message.cluster_id.isnot(None),
        ).group_by(Message.cluster_id).all()
        
        for cluster_id, msg_count in sender_clusters:
            cluster_nid = f"cluster-{cluster_id}"
            if cluster_nid in node_ids:
                edges.append({
                    "source": sender_nid,
                    "target": cluster_nid,
                    "type": "participates_in",
                    "weight": min(msg_count, 20),
                })
    
    # --- Edges: sender → domain (shared links from) ---
    for sender in top_senders[:max_senders]:
        sender_nid = f"sender-{sender.id}"
        if sender_nid not in node_ids:
            continue
        
        sender_domains = db.query(
            Link.domain, func.count(Link.id)
        ).join(Message, Message.id == Link.message_id).filter(
            Message.sender_id == sender.id,
            Link.domain.isnot(None),
        ).group_by(Link.domain).all()
        
        for domain, count in sender_domains:
            domain_nid = f"domain-{domain}"
            if domain_nid in node_ids:
                edges.append({
                    "source": sender_nid,
                    "target": domain_nid,
                    "type": "shared_links",
                    "weight": min(count, 10),
                })
    
    # --- Edges: important message → sender ---
    if not filter_type or filter_type == "important":
        for msg in (important_msgs if 'important_msgs' in dir() else []):
            msg_nid = f"important-{msg.id}"
            if msg_nid not in node_ids:
                continue
            
            if msg.sender_id:
                sender_nid = f"sender-{msg.sender_id}"
                if sender_nid in node_ids:
                    edges.append({
                        "source": msg_nid,
                        "target": sender_nid,
                        "type": "sent_by",
                        "weight": 2,
                    })
            
            if msg.cluster_id:
                cluster_nid = f"cluster-{msg.cluster_id}"
                if cluster_nid in node_ids:
                    edges.append({
                        "source": msg_nid,
                        "target": cluster_nid,
                        "type": "belongs_to",
                        "weight": 2,
                    })
    
    # Trim to max_nodes
    if len(nodes) > max_nodes:
        nodes = nodes[:max_nodes]
        valid_ids = {n["id"] for n in nodes}
        edges = [e for e in edges if e["source"] in valid_ids and e["target"] in valid_ids]
    
    logger.info(f"[Graph] Chat {chat_id}: Built graph with {len(nodes)} nodes and {len(edges)} edges")
    
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "node_types": {
                "sender": sum(1 for n in nodes if n["type"] == "sender"),
                "cluster": sum(1 for n in nodes if n["type"] == "cluster"),
                "domain": sum(1 for n in nodes if n["type"] == "domain"),
                "important": sum(1 for n in nodes if n["type"] == "important"),
            },
        },
    }