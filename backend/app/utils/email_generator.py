"""
AI-powered administrative email generator using Gemini.

Supported email types:
  - attestation   : Request for an enrollment/attendance certificate
  - reclamation   : Grade or administrative complaint
  - stage         : Internship request letter
  - absence       : Absence justification request
  - rattrapage    : Make-up exam request
  - custom        : Free-form request described by the user
"""

from app.utils.gemini_client import chat

# Email type → French administrative description
EMAIL_TYPE_DESCRIPTIONS = {
    "attestation":  "demande d'attestation de scolarité / d'inscription",
    "reclamation":  "réclamation concernant une note ou une décision administrative",
    "stage":        "demande de convention de stage / lettre de motivation pour un stage",
    "absence":      "justification d'absence et demande de régularisation",
    "rattrapage":   "demande d'examen de rattrapage",
    "custom":       "demande administrative personnalisée",
}

SYSTEM_INSTRUCTION = (
    "You are an expert at writing formal French academic administrative emails. "
    "Write polite, professional, and concise emails following French administrative conventions. "
    "Always include: Objet (subject line), greeting, body paragraphs, closing formula, and signature placeholder. "
    "If the user writes in Arabic or English, still write the email in formal French "
    "but add a brief translation at the end in the user's language."
)


def generate_email(
    email_type: str,
    student_name: str,
    student_id: str,
    details: str = "",
    recipient: str = "Monsieur/Madame le Directeur",
    university: str = "Institut International de Technologie / NAU",
) -> dict:
    """
    Generate a formal administrative email using Gemini.

    Returns:
        {
            "subject": str,
            "body":    str,
            "type":    str
        }
    """
    description = EMAIL_TYPE_DESCRIPTIONS.get(email_type, EMAIL_TYPE_DESCRIPTIONS["custom"])

    prompt = (
        f"Génère un email administratif universitaire formel pour une "
        f"'{description}'.\n\n"
        f"Informations de l'étudiant :\n"
        f"- Nom complet : {student_name}\n"
        f"- Numéro étudiant : {student_id}\n"
        f"- Établissement : {university}\n"
        f"- Destinataire : {recipient}\n"
        f"- Détails supplémentaires : {details or 'Aucun'}\n\n"
        f"Fournis d'abord la ligne Objet (préfixée par 'Objet:'), "
        f"puis l'email complet en dessous."
    )

    raw = chat(prompt, system_instruction=SYSTEM_INSTRUCTION)

    # Split subject line from body
    subject = f"Demande – {description.capitalize()}"
    body = raw

    lines = raw.strip().split("\n")
    for i, line in enumerate(lines):
        if line.lower().startswith("objet"):
            subject = line.split(":", 1)[-1].strip()
            body = "\n".join(lines[i + 1:]).strip()
            break

    return {
        "subject":    subject,
        "body":       body,
        "email_type": email_type,
    }
