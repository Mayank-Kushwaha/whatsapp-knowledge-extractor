"""Graph API routes — knowledge graph data endpoint.

GET /api/chats/{chat_id}/graph — returns nodes + edges for Cytoscape.js
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.services.graph_builder import build_graph_data

logger = logging.getLogger(__name__)

router = APIRouter(tags=["graph"])


class GraphNodeMetadata(BaseModel):
    """Flexible metadata for graph nodes."""
    class Config:
        extra = "allow"


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    size: int
    color: str
    metadata: dict = {}


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str
    weight: int = 1


class GraphStats(BaseModel):
    total_nodes: int
    total_edges: int
    node_types: dict = {}


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    stats: GraphStats


@router.get("/api/chats/{chat_id}/graph", response_model=GraphResponse)
async def get_chat_graph(
    chat_id: int,
    max_nodes: int = Query(500, ge=10, le=2000),
    filter_type: Optional[str] = Query(None, description="Filter by node type: sender|cluster|domain|important"),
    filter_sender: Optional[str] = Query(None),
    filter_cluster: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Get knowledge graph data for a chat."""
    data = build_graph_data(
        db,
        chat_id,
        max_nodes=max_nodes,
        filter_type=filter_type,
        filter_sender=filter_sender,
        filter_cluster=filter_cluster,
    )
    return GraphResponse(**data)