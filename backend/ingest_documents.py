"""
ingest_documents.py
-------------------
Bulk-load university documents into Supabase with Gemini embeddings.

Usage (from the project root with venv active):
    python ingest_documents.py

Add your real documents to the DOCUMENTS list below before running.
Each document will be embedded and stored for semantic search.
"""

import os
import sys

# Make sure the app package is importable
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from google import genai
from google.genai import types
from supabase import create_client

# ── Configuration ───────────────────────────────────────────────────────────────────────────────
SUPABASE_URL   = os.environ["SUPABASE_URL"]
SUPABASE_KEY   = os.environ["SUPABASE_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]

gemini = genai.Client(api_key=GEMINI_API_KEY)
sb     = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Sample University Documents ───────────────────────────────────────────────
# Replace / extend with real content from your university's official documents.
DOCUMENTS = [
    {
        "title": "Règlement intérieur – Absences",
        "type":  "regulation",
        "content": (
            "Tout étudiant est tenu d'assister à la totalité des cours, TD et TP. "
            "Au-delà de 20% d'absences injustifiées dans une matière, l'étudiant est "
            "déclaré défaillant et ne peut pas passer l'examen final de cette matière. "
            "Toute absence doit être justifiée dans les 48h auprès du secrétariat "
            "avec un justificatif officiel (certificat médical, convocation, etc.)."
        ),
    },
    {
        "title": "Procédure d'inscription et réinscription",
        "type":  "procedure",
        "content": (
            "Les inscriptions pédagogiques se déroulent en début de chaque semestre. "
            "L'étudiant doit présenter : carte d'identité nationale, photos d'identité, "
            "reçu de paiement des frais de scolarité, et justificatif de résidence. "
            "La réinscription en 2ème année est conditionnée par la validation de 50% "
            "des crédits de 1ère année. Tout dossier incomplet sera refusé."
        ),
    },
    {
        "title": "Demande d'attestation de scolarité",
        "type":  "procedure",
        "content": (
            "Pour obtenir une attestation de scolarité, l'étudiant doit s'adresser "
            "au secrétariat avec sa carte étudiante. Le délai de traitement est de "
            "3 jours ouvrables. L'attestation est délivrée gratuitement pour les "
            "démarches administratives (visa, banque, assurance). "
            "Une attestation spéciale pour bourse nécessite un délai de 5 jours."
        ),
    },
    {
        "title": "Règlement des examens et rattrapage",
        "type":  "regulation",
        "content": (
            "Les examens finaux sont organisés à la fin de chaque semestre selon le "
            "calendrier officiel affiché sur le tableau d'annonces. "
            "L'étudiant absent à un examen sans justificatif préalable obtient la note 0. "
            "Une session de rattrapage est organisée pour les matières où la moyenne "
            "est inférieure à 10/20, dans un délai de 3 semaines après les résultats. "
            "Les inscriptions au rattrapage sont obligatoires et limitées à 3 matières par session."
        ),
    },
    {
        "title": "Procédure de demande de stage PFE",
        "type":  "procedure",
        "content": (
            "Le Projet de Fin d'Études (PFE) est obligatoire en dernière année. "
            "L'étudiant doit soumettre une fiche de demande de convention de stage "
            "au secrétariat au moins 30 jours avant le début du stage. "
            "La convention doit être signée par l'entreprise, l'étudiant et le directeur de l'établissement. "
            "Un encadrant académique est attribué automatiquement. "
            "Le rapport de PFE doit être déposé 15 jours avant la date de soutenance."
        ),
    },
    {
        "title": "Bourses et aides financières",
        "type":  "faq",
        "content": (
            "Les étudiants peuvent bénéficier de bourses nationales attribuées par le "
            "Ministère de l'Enseignement Supérieur selon le revenu familial. "
            "Le dossier de bourse comprend : formulaire de demande, certificat de scolarité, "
            "justificatifs de revenus des parents et relevé de notes. "
            "La bourse est versée trimestriellement. Les étudiants étrangers peuvent "
            "bénéficier de bourses spéciales sous conditions. Renseignements au bureau des affaires sociales."
        ),
    },
    {
        "title": "Calendrier universitaire 2025-2026",
        "type":  "announcement",
        "content": (
            "Rentrée universitaire : 15 septembre 2025. "
            "Fin du 1er semestre : 31 janvier 2026. "
            "Examens du 1er semestre : 2–16 février 2026. "
            "Début du 2ème semestre : 23 février 2026. "
            "Fin du 2ème semestre : 15 juin 2026. "
            "Examens du 2ème semestre : 17 juin – 5 juillet 2026. "
            "Sessions de rattrapage : 20–31 juillet 2026. "
            "Congés de mi-semestre : voir tableau d'affichage."
        ),
    },
    {
        "title": "Réclamations et recours académiques",
        "type":  "procedure",
        "content": (
            "Tout étudiant contestant une note dispose de 5 jours ouvrables après "
            "l'affichage des résultats pour déposer une réclamation écrite au secrétariat. "
            "La réclamation doit préciser la matière, la note contestée et les motifs. "
            "Une commission de révision examine la copie dans un délai de 10 jours. "
            "La décision de la commission est définitive et ne peut faire l'objet "
            "que d'un recours hiérarchique au Ministère de l'Enseignement Supérieur."
        ),
    },
    {
        "title": "Paiement des frais de scolarité",
        "type":  "procedure",
        "content": (
            "Les frais de scolarité sont payables en deux tranches : "
            "50% lors de l'inscription en septembre, 50% avant le 1er mars. "
            "Le paiement s'effectue par virement bancaire ou chèque à l'ordre de l'établissement. "
            "Tout retard de paiement entraîne une pénalité de 2% par mois. "
            "En cas de difficultés financières, un étalement sur 4 mois peut être accordé "
            "sur demande écrite adressée au directeur administratif."
        ),
    },
    {
        "title": "FAQ – Questions fréquentes des étudiants",
        "type":  "faq",
        "content": (
            "Q: Comment obtenir mon relevé de notes ? "
            "R: Demandez au secrétariat avec votre carte étudiante. Délai : 2 jours.\n"
            "Q: Comment changer de filière ? "
            "R: Dépôt d'une demande au bureau pédagogique avant le 30 octobre.\n"
            "Q: Où s'adresser pour un problème de Wi-Fi ? "
            "R: Service informatique, bâtiment B, bureau 102.\n"
            "Q: Comment accéder à la bibliothèque numérique ? "
            "R: Via l'ENT avec vos identifiants universitaires.\n"
            "Q: Quelles sont les conditions pour valider une année ? "
            "R: Moyenne générale ≥ 10/20 avec compensation possible entre matières."
        ),
    },
]


def embed_text(text: str) -> list[float]:
    result = gemini.models.embed_content(
        model="models/gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=768,
        ),
    )
    return result.embeddings[0].values


def ingest():
    print(f"Starting ingestion of {len(DOCUMENTS)} documents...\n")

    for i, doc in enumerate(DOCUMENTS, 1):
        print(f"[{i}/{len(DOCUMENTS)}] Embedding: {doc['title']}")
        embedding = embed_text(f"{doc['title']}\n\n{doc['content']}")

        sb.table("documents").insert({
            "title":     doc["title"],
            "content":   doc["content"],
            "type":      doc["type"],
            "embedding": embedding,
        }).execute()

        print(f"           ✓ Saved to Supabase")

    print(f"\nDone! {len(DOCUMENTS)} documents ingested successfully.")


if __name__ == "__main__":
    ingest()
