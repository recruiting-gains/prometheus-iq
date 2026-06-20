from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUTPUT = "/Users/cruzgarza/Documents/Prometheus/legal/Prometheus_IQ_Authorized_User_NDA_DRAFT.docx"
BLUE = RGBColor(46, 116, 181)
DARK = RGBColor(25, 32, 38)
MUTED = RGBColor(92, 101, 111)


def style_run(run, size=11, bold=False, italic=False, color=DARK):
    run.font.name = "Calibri"
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Calibri")
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Calibri")
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    return run


def keep(paragraph, next_paragraph=False):
    p_pr = paragraph._p.get_or_add_pPr()
    tag = "w:keepNext" if next_paragraph else "w:keepLines"
    if p_pr.find(qn(tag)) is None:
        p_pr.append(OxmlElement(tag))


def body(doc, text, after=6, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.10
    style_run(p.add_run(text), italic=italic)
    keep(p)
    return p


def clause(doc, marker, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.25)
    p.paragraph_format.first_line_indent = Inches(-0.25)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.10
    style_run(p.add_run(marker + " "), bold=True)
    style_run(p.add_run(text))
    keep(p)
    return p


def heading(doc, text):
    p = doc.add_paragraph(text, style="Heading 1")
    keep(p, next_paragraph=True)
    return p


def page_number(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, text, end])


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
section.header_distance = Inches(0.492)
section.footer_distance = Inches(0.492)

normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
normal.font.size = Pt(11)
normal.font.color.rgb = DARK
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.10

h1 = doc.styles["Heading 1"]
h1.font.name = "Calibri"
h1._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
h1._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
h1.font.size = Pt(16)
h1.font.bold = True
h1.font.color.rgb = BLUE
h1.paragraph_format.space_before = Pt(16)
h1.paragraph_format.space_after = Pt(8)

hp = section.header.paragraphs[0]
style_run(hp.add_run("PROMETHEUS IQ  |  CONFIDENTIAL  |  DRAFT FOR ATTORNEY REVIEW"), size=8.5, bold=True, color=MUTED)
fp = section.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
style_run(fp.add_run("Authorized User NDA  |  Page "), size=8.5, color=MUTED)
page_number(fp)

p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(2)
style_run(p.add_run("PROMETHEUS"), size=10, bold=True, color=BLUE)
p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(6)
style_run(p.add_run("Prometheus IQ"), size=29, bold=True)
p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(16)
style_run(p.add_run("Authorized User Confidentiality, Evaluation, and Intellectual Property Agreement"), size=14, color=MUTED)

body(doc, "ATTORNEY REVIEW REQUIRED. This template is a drafting aid and not legal advice. A licensed attorney should review it before signature, particularly the legal entity, workplace authorization, privacy, liability, and enforceability terms.", italic=True, after=14)

body(doc, "Effective Date: [MONTH DAY, YEAR]")
body(doc, "Provider: Cruz Garza, an individual doing business as Prometheus (\"Prometheus\")")
body(doc, "Authorized User: [ANTHONY'S FULL LEGAL NAME] (\"User\")")
body(doc, "Evaluation Period: [START DATE] through [END DATE]")

body(doc, "This Authorized User Confidentiality, Evaluation, and Intellectual Property Agreement (the \"Agreement\") governs User's limited evaluation of Prometheus IQ. In exchange for access to the nonpublic product, methods, and materials, Prometheus and User agree as follows:")

heading(doc, "1. Limited Evaluation Access")
clause(doc, "1.1", "Prometheus grants User a limited, revocable, nonexclusive, nontransferable, nonsublicensable right during the Evaluation Period to use Prometheus IQ solely for the approved private field-sales test.")
clause(doc, "1.2", "User may not share credentials or permit any other person to access Prometheus IQ. Access ends automatically when the Evaluation Period ends or Prometheus revokes access.")
clause(doc, "1.3", "User will follow Prometheus instructions and applicable workplace policies. User is not authorized by this Agreement to bind, represent, or make commitments for User's employer or any other business.")

heading(doc, "2. Confidential Information")
clause(doc, "2.1", "\"Confidential Information\" includes Prometheus IQ; nonpublic demonstrations, screenshots, documentation, credentials, routes, outputs, product plans, pricing, security information, scoring inputs and outputs, intelligence loops, algorithms, models, prompts, workflows, schemas, methods, source or object code, inventions, know-how, and all other information a reasonable person would understand to be confidential.")
clause(doc, "2.2", "User will use Confidential Information only for the approved evaluation, protect it with reasonable care, and not disclose it to any person without Prometheus's prior written consent.")
clause(doc, "2.3", "Confidentiality duties do not apply to information User can document was lawfully known without restriction, independently developed without use of Confidential Information, lawfully received from a third party without duty, or publicly available without breach.")
clause(doc, "2.4", "Confidentiality obligations continue for five years after disclosure. Obligations concerning trade secrets continue for as long as the information remains a trade secret under applicable law.")

heading(doc, "3. No Reverse Engineering or Competitive Use")
body(doc, "User will not, directly or indirectly:")
clause(doc, "(a)", "reverse engineer, decompile, disassemble, decode, translate, trace, probe, derive, discover, reconstruct, or attempt to determine any source code, object-code structure, scoring logic, intelligence loop, algorithm, model, weighting, workflow, prompt, schema, or underlying method in Prometheus IQ, except only to the extent a restriction is prohibited by nonwaivable law;")
clause(doc, "(b)", "copy, modify, adapt, reproduce, distribute, sublicense, sell, lease, publish, frame, mirror, scrape, crawl, bulk extract, or create derivative works from Prometheus IQ;")
clause(doc, "(c)", "use Prometheus IQ, Confidential Information, or evaluation results to design, train, improve, benchmark, validate, or market a competing product or service;")
clause(doc, "(d)", "circumvent authentication, permissions, security controls, tenant separation, or usage limits, or conduct penetration, load, or automated testing without prior written authorization; or")
clause(doc, "(e)", "share nonpublic screenshots, demonstrations, outputs, credentials, benchmarks, or security findings without prior written permission.")

heading(doc, "4. Ownership and Feedback")
clause(doc, "4.1", "Prometheus owns all right, title, and interest in Prometheus IQ and all related software, documentation, scoring logic, intelligence loops, models, methods, inventions, improvements, derivative works, know-how, trade secrets, and intellectual property. User receives no ownership interest.")
clause(doc, "4.2", "User retains ownership of User's personal information and any data User is legally authorized to provide. No employer or third-party data ownership is transferred by this Agreement.")
clause(doc, "4.3", "If User voluntarily provides suggestions or feedback, User grants Prometheus a worldwide, perpetual, irrevocable, royalty-free right to use that feedback without identifying User. This does not transfer ownership of User's or an employer's underlying data.")

heading(doc, "5. Data and Workplace Authorization")
clause(doc, "5.1", "User will enter only business locations and aggregate counts approved for the evaluation, such as visits, conversations, leads, outcomes, and units. User will not enter customer or prospect names, personal phone numbers, personal emails, payment data, credentials, government identifiers, health or biometric data, minors' information, or other sensitive personal data.")
clause(doc, "5.2", "User represents that User will not upload confidential employer or third-party information unless User has written authorization to do so. User will comply with workplace rules, solicitation rules, location permissions, privacy obligations, and applicable law.")
clause(doc, "5.3", "User will promptly report a lost device, compromised credentials, data loss, unauthorized access, or suspected misuse to prometheusrouteiq@gmail.com and any required employer contact.")

heading(doc, "6. Evaluation Records and Backups")
clause(doc, "6.1", "User will make the agreed end-of-day backup after the final entry and deliver it through the approved method. User will not import another person's backup into User's application.")
clause(doc, "6.2", "Prometheus may process evaluation data to validate usability, analyze results, secure the product, and improve Prometheus IQ. Public use of User's name, employer, quote, logo, or identifiable results requires separate written permission from the appropriate rights holder.")

heading(doc, "7. No Guarantee and User Responsibility")
clause(doc, "7.1", "Prometheus IQ is an early evaluation product provided \"as is\" and \"as available.\" Prometheus does not guarantee sales, leads, conversions, route accuracy, fuel savings, uninterrupted access, data preservation, or any business outcome.")
clause(doc, "7.2", "Prometheus IQ provides decision support only. User remains responsible for safe driving, route choices, lawful solicitation, permissions, accurate sales statements, workplace conduct, and all actions taken in the field.")

heading(doc, "8. Termination and Return")
clause(doc, "8.1", "Either party may end the evaluation by written notice. Prometheus may immediately suspend or terminate access for security risk, misuse, unlawful conduct, or breach.")
clause(doc, "8.2", "When access ends, User will stop using Prometheus IQ, delete or return credentials and nonpublic materials as directed, and continue complying with provisions that by their nature survive, including confidentiality, restrictions, ownership, disclaimers, remedies, and governing law.")

heading(doc, "9. Remedies and Liability")
clause(doc, "9.1", "Unauthorized use or disclosure of Prometheus technology or Confidential Information may cause irreparable harm. Subject to applicable law, Prometheus may seek injunctive relief in addition to other remedies.")
clause(doc, "9.2", "TO THE MAXIMUM EXTENT PERMITTED BY LAW, PROMETHEUS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES, OR LOST PROFITS, BUSINESS, GOODWILL, OR DATA. PROMETHEUS'S AGGREGATE LIABILITY ARISING FROM THIS EVALUATION WILL NOT EXCEED ONE HUNDRED DOLLARS ($100), EXCEPT FOR LIABILITY THAT CANNOT LAWFULLY BE LIMITED.")

heading(doc, "10. Relationship and General Terms")
clause(doc, "10.1", "This Agreement does not create employment, compensation, agency, partnership, joint venture, fiduciary duty, exclusivity, or authority to bind Prometheus or any employer.")
clause(doc, "10.2", "Texas law governs this Agreement. The state and federal courts in Harris County, Texas have exclusive jurisdiction and venue. Before filing suit, the parties will attempt in good faith for 15 days to resolve the dispute, except either party may seek immediate equitable relief for threatened misuse of intellectual property, Confidential Information, or credentials.")
clause(doc, "10.3", "This Agreement is the complete agreement concerning User's evaluation access. Amendments must be written and signed. If a provision is unenforceable, it will be modified only as necessary and the remainder will continue. Electronic signatures and counterparts are permitted to the extent allowed by law.")

heading(doc, "11. Protected Disclosures and Trade-Secret Immunity Notice")
clause(doc, "11.1", "Nothing in this Agreement prohibits lawful reporting of suspected legal violations to a government official or attorney, participation in a government investigation, or other legally protected conduct.")
clause(doc, "11.2", "Under 18 U.S.C. Section 1833(b), an individual is not criminally or civilly liable under federal or state trade-secret law for disclosing a trade secret in confidence to a federal, state, or local government official, directly or indirectly, or to an attorney, solely to report or investigate a suspected legal violation; or for disclosure in a complaint or other document filed under seal. An individual bringing an anti-retaliation claim may disclose the trade secret to the individual's attorney and use it in court if filings are made under seal and disclosure occurs only as permitted by court order.")

heading(doc, "Signatures")
body(doc, "The parties intend to be legally bound as of the Effective Date.")
body(doc, "PROMETHEUS")
body(doc, "Cruz Garza, individually and doing business as Prometheus")
body(doc, "Signature: __________________________________________")
body(doc, "Date: ______________________________________________")
body(doc, "AUTHORIZED USER")
body(doc, "Full legal name: _____________________________________")
body(doc, "Signature: __________________________________________")
body(doc, "Date: ______________________________________________")

doc.core_properties.title = "Prometheus IQ Authorized User Confidentiality, Evaluation, and Intellectual Property Agreement"
doc.core_properties.subject = "Attorney-review draft for an individual Prometheus IQ private tester"
doc.core_properties.author = ""
doc.core_properties.last_modified_by = ""
doc.core_properties.comments = "Drafting aid only; attorney review required before use."
doc.save(OUTPUT)
print(OUTPUT)
