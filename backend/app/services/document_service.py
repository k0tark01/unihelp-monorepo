"""Document service for document management operations."""
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class DocumentFilter:
    """Filter criteria for document queries."""
    doc_type: Optional[str] = None
    search_text: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


class DocumentService:
    """
    Service for document management operations.
    
    Handles:
    - Document CRUD operations
    - Document listing and filtering
    - Document metadata management
    """
    
    def __init__(self, supabase_client, embedding_service):
        """
        Initialize document service.
        
        Args:
            supabase_client: Supabase client instance
            embedding_service: Embedding service instance
        """
        self.supabase = supabase_client
        self.embedding_service = embedding_service
    
    def get_all(self, filters: Optional[DocumentFilter] = None) -> List[Dict]:
        """
        Get all documents with optional filtering.
        
        Args:
            filters: Optional filter criteria
        
        Returns:
            List of documents
        """
        query = self.supabase.table('documents').select('id, title, type, file_url, created_at')
        
        if filters:
            if filters.doc_type:
                query = query.eq('type', filters.doc_type)
            
            if filters.limit:
                query = query.limit(filters.limit)
            
            if filters.offset:
                query = query.offset(filters.offset)
        
        response = query.execute()
        return response.data or []
    
    def get_by_id(self, doc_id: int) -> Optional[Dict]:
        """
        Get a document by ID.
        
        Args:
            doc_id: Document ID
        
        Returns:
            Document data or None if not found
        """
        try:
            response = (
                self.supabase.table('documents')
                .select('id, title, content, type, file_url, created_at')
                .eq('id', doc_id)
                .single()
                .execute()
            )
            return response.data
        except Exception:
            return None
    
    def create(
        self,
        title: str,
        content: str,
        doc_type: Optional[str] = None,
        file_url: Optional[str] = None,
    ) -> Dict:
        """
        Create a new document.

        Args:
            title: Document title
            content: Document content
            doc_type: Document type
            file_url: Optional public URL of the original file in Supabase Storage

        Returns:
            Created document data
        """
        # Generate embedding
        embedding_text = f"{title}\n\n{content}"
        embedding = self.embedding_service.embed_text(embedding_text)

        row = {
            'title': title,
            'content': content,
            'type': doc_type,
            'embedding': embedding,
        }
        if file_url:
            row['file_url'] = file_url

        response = self.supabase.table('documents').insert(row).execute()
        return response.data[0] if response.data else None
    
    def update(self, doc_id: int, updates: Dict) -> Optional[Dict]:
        """
        Update a document.
        
        Args:
            doc_id: Document ID
            updates: Fields to update
        
        Returns:
            Updated document data or None if not found
        """
        # If title or content changed, regenerate embedding
        if 'title' in updates or 'content' in updates:
            existing = self.get_by_id(doc_id)
            if not existing:
                return None
            
            new_title = updates.get('title', existing['title'])
            new_content = updates.get('content', existing['content'])
            updates['embedding'] = self.embedding_service.embed_text(f"{new_title}\n\n{new_content}")
        
        try:
            response = (
                self.supabase.table('documents')
                .update(updates)
                .eq('id', doc_id)
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception:
            return None
    
    def delete(self, doc_id: int) -> bool:
        """
        Delete a document.
        
        Args:
            doc_id: Document ID
        
        Returns:
            True if deleted, False otherwise
        """
        try:
            self.supabase.table('documents').delete().eq('id', doc_id).execute()
            return True
        except Exception:
            return False
    
    def count(self, doc_type: Optional[str] = None) -> int:
        """
        Count documents.
        
        Args:
            doc_type: Optional document type filter
        
        Returns:
            Document count
        """
        query = self.supabase.table('documents').select('id', count='exact')
        
        if doc_type:
            query = query.eq('type', doc_type)
        
        response = query.execute()
        return response.count or 0
