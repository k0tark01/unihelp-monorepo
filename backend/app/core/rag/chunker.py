"""Advanced text chunking with semantic awareness.

Adapted from rag-base/text_chunker.py with improvements.
"""
import re
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class ChunkConfig:
    """Configuration for text chunking."""
    chunk_size: int = 1000
    chunk_overlap: int = 200
    strategy: str = 'semantic'  # 'fixed', 'semantic', 'hierarchical'


@dataclass
class TextChunk:
    """Represents a text chunk with metadata."""
    text: str
    chunk_index: int
    chunk_count: int
    char_count: int
    word_count: int
    metadata: Dict = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            'text': self.text,
            'chunk_index': self.chunk_index,
            'chunk_count': self.chunk_count,
            'char_count': self.char_count,
            'word_count': self.word_count,
            'metadata': self.metadata or {}
        }


class TextChunker:
    """
    Advanced text chunking with multiple strategies.
    
    Implements:
    - Fixed-size chunking with overlap
    - Semantic chunking (paragraph/section aware)
    - Hierarchical chunking for better context
    """
    
    def __init__(self, config: Optional[ChunkConfig] = None):
        """
        Initialize text chunker.
        
        Args:
            config: Chunking configuration
        """
        self.config = config or ChunkConfig()
    
    def chunk_text(self, text: str, metadata: Optional[Dict] = None) -> List[TextChunk]:
        """
        Chunk text into smaller pieces.
        
        Args:
            text: Input text
            metadata: Optional metadata to attach to each chunk
        
        Returns:
            List of TextChunk objects
        """
        if not text or not text.strip():
            return []
        
        # Choose chunking strategy
        if self.config.strategy == 'semantic':
            chunks = self._semantic_chunk(text)
        elif self.config.strategy == 'hierarchical':
            chunks = self._hierarchical_chunk(text)
        else:  # 'fixed'
            chunks = self._fixed_chunk(text)
        
        # Create TextChunk objects
        result = []
        for i, chunk_text in enumerate(chunks):
            chunk = TextChunk(
                text=chunk_text,
                chunk_index=i,
                chunk_count=len(chunks),
                char_count=len(chunk_text),
                word_count=len(chunk_text.split()),
                metadata=metadata or {}
            )
            result.append(chunk)
        
        return result
    
    def _fixed_chunk(self, text: str) -> List[str]:
        """
        Fixed-size chunking with overlap.
        Simple but effective for uniform processing.
        """
        chunks = []
        text_length = len(text)
        
        if text_length <= self.config.chunk_size:
            return [text]
        
        start = 0
        while start < text_length:
            end = start + self.config.chunk_size
            
            # Try to break at sentence boundary
            if end < text_length:
                # Look for sentence endings near the boundary
                boundary = text[start:end].rfind('. ')
                if boundary > self.config.chunk_size * 0.6:  # At least 60% of chunk_size
                    end = start + boundary + 1
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Move start position with overlap
            start = end - self.config.chunk_overlap
        
        return chunks
    
    def _semantic_chunk(self, text: str) -> List[str]:
        """
        Semantic chunking that respects document structure.
        Tries to keep related content together.
        """
        semantic_units = []
        
        # Split by double newlines (paragraphs)
        paragraphs = re.split(r'\n\n+', text)
        
        current_chunk = []
        current_length = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            para_length = len(para)
            
            # If paragraph alone exceeds chunk_size, split it
            if para_length > self.config.chunk_size:
                # Save current chunk if any
                if current_chunk:
                    semantic_units.append('\n\n'.join(current_chunk))
                    current_chunk = []
                    current_length = 0
                
                # Split large paragraph using fixed chunking
                para_chunks = self._fixed_chunk(para)
                semantic_units.extend(para_chunks)
            
            # If adding this paragraph exceeds chunk_size, start new chunk
            elif current_length + para_length > self.config.chunk_size:
                if current_chunk:
                    semantic_units.append('\n\n'.join(current_chunk))
                current_chunk = [para]
                current_length = para_length
            
            # Add to current chunk
            else:
                current_chunk.append(para)
                current_length += para_length + 2  # +2 for newlines
        
        # Don't forget the last chunk
        if current_chunk:
            semantic_units.append('\n\n'.join(current_chunk))
        
        return semantic_units
    
    def _hierarchical_chunk(self, text: str) -> List[str]:
        """
        Hierarchical chunking that creates parent-child relationships.
        Useful for structured documents.
        """
        # First, try to identify major sections
        sections = self._identify_sections(text)
        
        if not sections:
            # Fallback to semantic chunking
            return self._semantic_chunk(text)
        
        chunks = []
        for section in sections:
            # Chunk each section semantically
            section_chunks = self._semantic_chunk(section)
            chunks.extend(section_chunks)
        
        return chunks
    
    def _identify_sections(self, text: str) -> List[str]:
        """
        Identify major sections in text.
        Looks for markdown headers, numbered sections, etc.
        """
        # Look for markdown headers or numbered sections
        section_pattern = r'(?:^|\n)(?:#{1,3}\s+|\d+\.\s+|\b(?:Chapter|Section|Part)\s+\d+)'
        matches = list(re.finditer(section_pattern, text, re.MULTILINE | re.IGNORECASE))
        
        if not matches:
            return []
        
        sections = []
        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            section = text[start:end].strip()
            if section:
                sections.append(section)
        
        return sections
