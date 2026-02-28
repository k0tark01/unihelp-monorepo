#!/usr/bin/env python3
"""
Quick test script to verify registration works without email verification.

Usage:
    python test_registration.py
"""

import os
import sys
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from app import create_app
from app.services.auth_service import AuthService, RegisterDTO
from app.supabase_client import get_supabase_client

def test_registration():
    """Test user registration without email verification."""
    print("=" * 60)
    print("Testing Registration (NO Email Verification)")
    print("=" * 60)
    
    app = create_app()
    
    with app.app_context():
        supabase = get_supabase_client()
        auth_service = AuthService(supabase)
        
        # Test registration DTO
        test_email = "test.student@unihelp.test"
        dto = RegisterDTO(
            email=test_email,
            password="test123456",
            full_name="Test Student",
            role="student",
            student_id="S2024001",
            department="Computer Science",
            level="L3"
        )
        
        print(f"\n📝 Registering user: {test_email}")
        print(f"   Role: {dto.role}")
        print(f"   Student ID: {dto.student_id}")
        
        try:
            result = auth_service.register(dto)
            
            print("\n✅ Registration Successful!")
            print(f"   User ID: {result.user.id}")
            print(f"   Email: {result.user.email}")
            print(f"   Full Name: {result.user.full_name}")
            print(f"   Role: {result.user.role}")
            print(f"   Active: {result.user.is_active}")
            print(f"   Access Token: {result.access_token[:50]}..." if result.access_token else "   Access Token: None")
            
            if result.access_token:
                print("\n🎉 SUCCESS: User can login immediately (no email verification needed)")
            else:
                print("\n⚠️  WARNING: No access token returned (email verification might be enabled)")
                print("   → Go to Supabase Dashboard → Authentication → Settings")
                print("   → Disable 'Confirm email'")
            
            return True
            
        except Exception as e:
            print(f"\n❌ Registration Failed: {e}")
            print("\nPossible causes:")
            print("1. Email already exists (try a different email)")
            print("2. Supabase credentials not set in .env")
            print("3. Database schema not applied (run supabase_schema.sql)")
            print("4. Email verification still enabled in Supabase")
            print("\nSee SUPABASE_SETUP.md for configuration instructions.")
            return False

if __name__ == "__main__":
    success = test_registration()
    sys.exit(0 if success else 1)
