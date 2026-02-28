"""Query service for RAG operations."""
from typing import List, Dict, Optional
from app.core.rag import RAGEngine


class QueryService:
    """
    Service for query/Q&A operations.
    
    Handles:
    - Question answering using RAG
    - Conversation context management
    - Query history tracking
    """
    
    def __init__(self, rag_engine: RAGEngine):
        """
        Initialize query service.
        
        Args:
            rag_engine: RAG engine instance
        """
        self.rag_engine = rag_engine
    
    def answer_question(
        self,
        question: str,
        top_k: int = 5,
        conversation_history: Optional[List[Dict]] = None
    ) -> Dict:
        """
        Answer a question using RAG.
        
        Args:
            question: User's question
            top_k: Number of documents to retrieve
            conversation_history: Optional conversation context
        
        Returns:
            Dictionary with answer and metadata
        """
        if not question or not question.strip():
            return {
                'error': 'Question cannot be empty',
                'success': False
            }
        
        # Process query through RAG engine
        result = self.rag_engine.query(
            question=question,
            top_k=top_k,
            conversation_history=conversation_history
        )
        
        return {
            'success': True,
            **result.to_dict()
        }
    
    def validate_conversation_history(self, history: List[Dict]) -> bool:
        """
        Validate conversation history format.
        
        Args:
            history: List of conversation messages
        
        Returns:
            True if valid, False otherwise
        """
        if not isinstance(history, list):
            return False
        
        for msg in history:
            if not isinstance(msg, dict):
                return False
            if 'role' not in msg or 'content' not in msg:
                return False
            if msg['role'] not in ['user', 'assistant', 'system']:
                return False
        
        return True
