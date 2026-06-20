from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from docx.enum.style import WD_STYLE_TYPE


OUTPUT = "/Users/cruzgarza/Documents/Prometheus/legal/Prometheus_IQ_Pilot_Confidentiality_Agreement_DRAFT.docx"

BLUE = RGBColor(46, 116, 181)
DARK_BLUE = RGBColor(31, 77, 120)
INK = RGBColor(25, 32, 38)
MUTED = RGBColor(92, 101, 111)
LIGHT_GRAY = "F2F4F7"
PALE_BLUE = "E8EEF5"
PALE_YELLOW = "FFF4CC"
WHITE = RGBColor(255, 255, 255)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, start=120, bottom=80, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths_dxa, indent_dxa=120):
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths_dxa)))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), str(indent_dxa))
    tbl_ind.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths_dxa:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)
    for row in table.rows:
        for index, cell in enumerate(row.cells):
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(widths_dxa[index]))
            tc_w.set(qn("w:type"), "dxa")
            set_cell_margins(cell)


def set_keep_with_next(paragraph, value=True):
    p_pr = paragraph._p.get_or_add_pPr()
    node = p_pr.find(qn("w:keepNext"))
    if value and node is None:
        p_pr.append(OxmlElement("w:keepNext"))
    elif not value and node is not None:
        p_pr.remove(node)


def set_keep_together(paragraph, value=True):
    p_pr = paragraph._p.get_or_add_pPr()
    node = p_pr.find(qn("w:keepLines"))
    if value and node is None:
        p_pr.append(OxmlElement("w:keepLines"))
    elif not value and node is not None:
        p_pr.remove(node)


def add_page_number(paragraph):
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


def font_run(run, size=11, bold=False, italic=False, color=INK, name="Calibri"):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    return run


def add_body(doc, text="", bold_prefix=None, italic=False, after=6, keep=True):
    p = doc.add_paragraph(style="Normal")
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.10
    if bold_prefix and text.startswith(bold_prefix):
        font_run(p.add_run(bold_prefix), bold=True)
        font_run(p.add_run(text[len(bold_prefix):]), italic=italic)
    else:
        font_run(p.add_run(text), italic=italic)
    if keep:
        set_keep_together(p)
    return p


def add_clause(doc, marker, text, indent=0.25, hanging=0.25, after=6):
    p = doc.add_paragraph(style="Clause")
    p.paragraph_format.left_indent = Inches(indent)
    p.paragraph_format.first_line_indent = Inches(-hanging)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.10
    font_run(p.add_run(marker + " "), bold=True)
    font_run(p.add_run(text))
    set_keep_together(p)
    return p


def add_heading(doc, text, level=1):
    p = doc.add_paragraph(text, style=f"Heading {level}")
    set_keep_with_next(p)
    return p


def add_placeholder_table(doc, rows):
    table = doc.add_table(rows=0, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.style = "Table Grid"
    for label, value in rows:
        cells = table.add_row().cells
        cells[0].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        cells[1].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_shading(cells[0], LIGHT_GRAY)
        p0 = cells[0].paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        font_run(p0.add_run(label), bold=True, size=10)
        p1 = cells[1].paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        font_run(p1.add_run(value), size=10, color=DARK_BLUE)
    set_table_geometry(table, [2700, 6660])
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
section.header_distance = Inches(0.492)
section.footer_distance = Inches(0.492)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Calibri"
normal._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
normal.font.size = Pt(11)
normal.font.color.rgb = INK
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.10

for level, size, color, before, after in (
    (1, 16, BLUE, 16, 8),
    (2, 13, BLUE, 12, 6),
    (3, 12, DARK_BLUE, 8, 4),
):
    style = styles[f"Heading {level}"]
    style.font.name = "Calibri"
    style._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
    style._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = color
    style.paragraph_format.space_before = Pt(before)
    style.paragraph_format.space_after = Pt(after)
    style.paragraph_format.keep_with_next = True

if "Clause" not in styles:
    clause_style = styles.add_style("Clause", WD_STYLE_TYPE.PARAGRAPH)
else:
    clause_style = styles["Clause"]
clause_style.font.name = "Calibri"
clause_style._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
clause_style._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
clause_style.font.size = Pt(11)
clause_style.font.color.rgb = INK

header = section.header
hp = header.paragraphs[0]
hp.alignment = WD_ALIGN_PARAGRAPH.LEFT
font_run(hp.add_run("PROMETHEUS IQ  |  CONFIDENTIAL  |  DRAFT FOR ATTORNEY REVIEW"), size=8.5, bold=True, color=MUTED)

footer = section.footer
fp = footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
font_run(fp.add_run("Prometheus IQ Pilot Agreement  |  Page "), size=8.5, color=MUTED)
add_page_number(fp)

# First-page customer-pack title block.
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(4)
p.paragraph_format.space_after = Pt(2)
font_run(p.add_run("PROMETHEUS"), size=10, bold=True, color=BLUE)

p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(0)
p.paragraph_format.space_after = Pt(6)
font_run(p.add_run("Prometheus IQ"), size=30, bold=True, color=INK)

p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(0)
p.paragraph_format.space_after = Pt(18)
font_run(p.add_run("Pilot Evaluation, Confidentiality, Data Use, and Intellectual Property Protection Agreement"), size=14, color=MUTED)

notice = doc.add_table(rows=1, cols=1)
notice.style = "Table Grid"
cell = notice.cell(0, 0)
set_cell_shading(cell, PALE_YELLOW)
set_cell_margins(cell, top=140, start=180, bottom=140, end=180)
np = cell.paragraphs[0]
np.paragraph_format.space_after = Pt(0)
font_run(np.add_run("ATTORNEY REVIEW REQUIRED. "), bold=True, size=9.5, color=INK)
font_run(np.add_run("This template is a drafting aid, not legal advice. A licensed attorney should confirm the correct Prometheus legal entity, state-specific enforceability, privacy obligations, insurance, taxes, and final commercial terms before signature."), size=9.5, color=INK)
set_table_geometry(notice, [9360])
doc.add_paragraph().paragraph_format.space_after = Pt(0)

add_placeholder_table(doc, [
    ("Effective Date", "[MONTH DAY, YEAR]"),
    ("Provider", "Cruz Garza, an individual doing business as Prometheus"),
    ("Customer", "[FULL LEGAL NAME AND ENTITY TYPE]"),
    ("Pilot", "Prometheus IQ private evaluation described in Exhibit A"),
])

add_body(doc, "This Pilot Evaluation, Confidentiality, Data Use, and Intellectual Property Protection Agreement (the \"Agreement\") is entered into as of the Effective Date by and between Cruz Garza, an individual doing business as Prometheus (\"Prometheus\" or \"Provider\"), and the Customer identified above (\"Customer\"). Provider and Customer may each be a \"Party\" and together the \"Parties.\"")

add_body(doc, "Customer wishes to evaluate Prometheus IQ with specifically authorized field-sales personnel. Provider will provide limited access only under the safeguards, restrictions, and pilot terms below. In consideration of the mutual promises in this Agreement, the Parties agree as follows:")

add_heading(doc, "1. Definitions", 1)
add_clause(doc, "1.1", "\"Authorized User\" means an employee or individual contractor of Customer who is named in Exhibit A, has a legitimate need to participate in the Pilot, and signs the Authorized User Acknowledgment in Exhibit B before receiving access.")
add_clause(doc, "1.2", "\"Confidential Information\" means nonpublic information disclosed by or on behalf of a Party that is marked confidential or that a reasonable person would understand to be confidential given its nature and the circumstances of disclosure. Provider Confidential Information includes Provider Technology, product plans, demonstrations, credentials, security information, pricing, documentation, scoring inputs and outputs, and nonpublic pilot methods. Customer Confidential Information includes Customer Data, sales operations, territories, pricing, personnel information, customer information, and nonpublic results.")
add_clause(doc, "1.3", "\"Customer Data\" means data submitted to Prometheus IQ by or for Customer or an Authorized User, including Customer locations, activity records, counts, outcomes, goals, and operational notes. Customer Data does not include Provider Technology, Aggregated Data, or De-identified Data.")
add_clause(doc, "1.4", "\"Provider Technology\" means Prometheus IQ and all pre-existing or independently developed software, source and object code, interfaces, documentation, workflows, scoring logic, intelligence loops, models, model configurations, prompts, schemas, methods, designs, inventions, know-how, trade secrets, improvements, and derivative works owned or controlled by Provider.")
add_clause(doc, "1.5", "\"Pilot\" means the limited evaluation described in Exhibit A. \"Pilot Results\" means measurements and findings generated during the Pilot, excluding personally identifiable information and each Party's pre-existing intellectual property.")
add_clause(doc, "1.6", "\"Aggregated Data\" means data combined across multiple records so that it does not identify Customer, an Authorized User, or an individual. \"De-identified Data\" means data reasonably modified to prevent identification and not reasonably linkable to Customer, an Authorized User, or an individual.")
add_clause(doc, "1.7", "\"Security Incident\" means confirmed unauthorized access to, acquisition of, disclosure of, alteration of, or loss of Customer Data in Provider's possession or control, excluding unsuccessful attempts that do not compromise Customer Data.")

add_heading(doc, "2. Pilot Scope and Conditions", 1)
add_clause(doc, "2.1", "Provider will make the Pilot available only for the dates, Authorized Users, business purpose, features, success measures, support level, and fees stated in Exhibit A. Customer will not treat the Pilot as a production system or safety-critical system.")
add_clause(doc, "2.2", "Customer represents that the person signing for Customer has authority to approve the Pilot, authorize the named users, permit the agreed processing of Customer Data, and bind Customer to this Agreement.")
add_clause(doc, "2.3", "Provider may suspend access reasonably necessary to address a security risk, suspected misuse, legal requirement, or material breach. Provider will give notice when reasonably practicable.")
add_clause(doc, "2.4", "Any custom feature, integration, data import, or change outside Exhibit A requires a written amendment or statement of work signed by both Parties.")

add_heading(doc, "3. Limited Evaluation License", 1)
add_clause(doc, "3.1", "Subject to this Agreement, Provider grants Customer a limited, revocable, nonexclusive, nontransferable, nonsublicensable license during the Pilot Term to permit Authorized Users to access and use Prometheus IQ solely for Customer's internal evaluation described in Exhibit A.")
add_clause(doc, "3.2", "No rights are granted by implication. Provider retains all rights not expressly granted. Access credentials are personal to the assigned Authorized User and may not be shared.")

add_heading(doc, "4. Use Restrictions and No Reverse Engineering", 1)
add_body(doc, "Customer will not, and will not permit any person to:")
add_clause(doc, "(a)", "reverse engineer, decompile, disassemble, decode, translate, trace, probe, derive, discover, reconstruct, or attempt to determine any source code, object code structure, algorithm, model, scoring logic, intelligence loop, weighting, method, workflow, data structure, prompt, or underlying idea embodied in Provider Technology, except only to the limited extent a restriction is prohibited by nonwaivable law;")
add_clause(doc, "(b)", "copy, modify, adapt, translate, create derivative works from, reproduce, frame, mirror, republish, distribute, sell, lease, sublicense, time-share, or provide Provider Technology to any third party;")
add_clause(doc, "(c)", "use Provider Technology or Pilot Results to design, train, improve, validate, benchmark, or market a competing product or service, or permit a competitor of Prometheus to access the Pilot;")
add_clause(doc, "(d)", "scrape, crawl, bulk extract, conduct automated queries against, load test, penetration test, security test, or attempt to circumvent authentication, permissions, rate limits, tenant separation, or other safeguards without Provider's prior written authorization;")
add_clause(doc, "(e)", "remove, obscure, or alter proprietary notices, or disclose screenshots, demonstrations, documentation, credentials, nonpublic outputs, benchmarks, or security findings without Provider's prior written approval;")
add_clause(doc, "(f)", "use the Pilot in violation of law, workplace policy, third-party rights, or the agreed data restrictions in Exhibit C; or")
add_clause(doc, "(g)", "allow access by anyone other than Authorized Users. Customer is responsible for Authorized Users' compliance with this Agreement.")

add_heading(doc, "5. Ownership and Intellectual Property", 1)
add_clause(doc, "5.1", "Provider owns all right, title, and interest in Provider Technology, including all intellectual property and trade-secret rights, and all improvements or derivative works to Provider Technology, whether developed before, during, or after the Pilot. Customer receives no ownership interest in Provider Technology.")
add_clause(doc, "5.2", "Customer owns all right, title, and interest in Customer Data, subject to the limited rights granted to Provider in this Agreement.")
add_clause(doc, "5.3", "Customer grants Provider a limited, nonexclusive right during the Pilot and applicable retention period to host, copy, transmit, process, display, and analyze Customer Data only to provide, secure, support, and evaluate the Pilot and to comply with law.")
add_clause(doc, "5.4", "Provider may create and use Aggregated Data and De-identified Data to operate, secure, analyze, and improve Provider Technology, provided Provider does not identify Customer, an Authorized User, or any individual, does not attempt re-identification, and does not publicly disclose Customer-specific results without separate written permission.")
add_clause(doc, "5.5", "If Customer or an Authorized User voluntarily provides suggestions, ideas, or feedback about Provider Technology, Customer grants Provider a worldwide, perpetual, irrevocable, royalty-free right to use that feedback without identifying Customer. Feedback does not transfer ownership of Customer Data or Customer Confidential Information.")

add_heading(doc, "6. Confidentiality", 1)
add_clause(doc, "6.1", "The receiving Party will use the disclosing Party's Confidential Information only to perform or evaluate the Pilot, protect it using at least reasonable care and no less care than it uses for similar information, and disclose it only to personnel and professional advisers who need to know it and are bound by confidentiality obligations at least as protective as this Agreement.")
add_clause(doc, "6.2", "Confidential Information does not include information the receiving Party can document: (a) is publicly available without breach; (b) was lawfully known without restriction before disclosure; (c) is lawfully received from a third party without confidentiality duty; or (d) is independently developed without use of the disclosing Party's Confidential Information.")
add_clause(doc, "6.3", "If law requires disclosure, the receiving Party will, to the extent legally permitted, promptly notify the disclosing Party, reasonably cooperate at the disclosing Party's expense in seeking protection, and disclose only the legally required portion.")
add_clause(doc, "6.4", "Confidentiality duties continue for five years after disclosure, except duties concerning trade secrets continue for as long as the information remains a trade secret under applicable law.")
add_clause(doc, "6.5", "Upon written request or termination, each Party will return or destroy the other Party's Confidential Information, except for records required by law and secure backup copies maintained automatically and not readily accessible in the ordinary course, which remain protected until deleted through the normal retention cycle.")

add_heading(doc, "7. Customer Data, Privacy, and Security", 1)
add_clause(doc, "7.1", "Customer determines what Customer Data is submitted and is responsible for the lawfulness, accuracy, and integrity of Customer Data and for providing required notices and obtaining required permissions from employees, contractors, customers, prospects, location owners, and other individuals.")
add_clause(doc, "7.2", "Unless Exhibit C expressly permits otherwise, Customer and Authorized Users will not submit names, personal phone numbers, personal email addresses, payment information, government identifiers, health information, biometric information, precise consumer geolocation, passwords, minors' information, or other sensitive personal data. Pilot entries should use aggregate counts and business-location information whenever possible.")
add_clause(doc, "7.3", "Provider will use reasonable administrative, technical, and organizational safeguards appropriate to the Pilot stage, including authentication, organization-level access controls when cloud accounts are enabled, least-privilege access, transport encryption, and backups described in Exhibit C. No system is completely secure, and Provider does not warrant that unauthorized access will never occur.")
add_clause(doc, "7.4", "Provider will notify Customer without unreasonable delay after confirming a Security Incident affecting Customer Data, provide information reasonably available about its nature and scope, take reasonable containment and remediation steps, and cooperate with Customer's legally required response. Notice is not an admission of fault or liability.")
add_clause(doc, "7.5", "Provider may use hosting, authentication, email, monitoring, and backup service providers as subprocessors. Provider remains responsible for using subprocessors under written terms appropriate to their role. Material subprocessors, hosting region, retention, and backup cadence should be identified in Exhibit C or an incorporated privacy notice.")
add_clause(doc, "7.6", "At the end of the Pilot, Provider will make Customer Data available for export if stated in Exhibit C and will delete or de-identify Customer Data according to the agreed retention schedule, subject to legal obligations and backup-cycle limitations.")

add_heading(doc, "8. Pilot Measurements, Findings, and Publicity", 1)
add_clause(doc, "8.1", "The Parties will define the baseline, success measures, data sources, test period, exclusions, and decision meeting before the Pilot begins. Neither Party will knowingly manipulate, omit, or mischaracterize material findings.")
add_clause(doc, "8.2", "Pilot Results may be affected by representative behavior, seasonality, market conditions, incentives, management practices, data quality, and other factors. Provider does not guarantee sales, leads, conversion, fuel savings, cost savings, or any other result.")
add_clause(doc, "8.3", "Neither Party may use the other Party's name, logo, trademarks, quotes, testimonials, or identifiable results in advertising, fundraising, social media, case studies, or public statements without separate written consent. Exhibit D may be signed after the Pilot for specifically approved uses.")

add_heading(doc, "9. Fees, Taxes, and Expenses", 1)
add_clause(doc, "9.1", "Pilot fees, if any, are stated in Exhibit A. Unless Exhibit A states otherwise, each Party bears its own expenses. Customer is responsible for applicable sales, use, and similar transaction taxes, excluding taxes based on Provider's net income.")
add_clause(doc, "9.2", "No investment, ownership interest, exclusivity right, or future subscription is created by a Pilot fee. Any paid continuation requires a separate written subscription or founding-pilot agreement.")

add_heading(doc, "10. Representations and Disclaimers", 1)
add_clause(doc, "10.1", "Each Party represents that it has authority to enter into this Agreement. Customer represents that its Pilot use and Customer Data will comply with applicable law, workplace policy, and third-party rights.")
add_clause(doc, "10.2", "THE PILOT AND PROVIDER TECHNOLOGY ARE PROVIDED \"AS IS\" AND \"AS AVAILABLE\" FOR EVALUATION. TO THE MAXIMUM EXTENT PERMITTED BY LAW, PROVIDER DISCLAIMS ALL EXPRESS, IMPLIED, AND STATUTORY WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, AVAILABILITY, AND RESULTS.")
add_clause(doc, "10.3", "Prometheus IQ provides decision support only. Customer and its representatives remain responsible for route choices, driving, workplace conduct, permissions to enter or solicit at locations, sales representations, legal compliance, and all business decisions.")

add_heading(doc, "11. Indemnification", 1)
add_clause(doc, "11.1", "Customer will defend, indemnify, and hold harmless Provider and its affiliates, personnel, and contractors from third-party claims, damages, penalties, costs, and reasonable attorneys' fees arising from: (a) Customer Data; (b) Customer's or an Authorized User's unlawful or unauthorized conduct; (c) failure to obtain required permissions or notices; or (d) Customer's breach of Sections 3, 4, 5, 6, or 7.")
add_clause(doc, "11.2", "Provider will promptly notify Customer of a covered claim, allow Customer reasonable control of the defense and settlement, and provide reasonable cooperation at Customer's expense. Customer may not settle a claim in a manner that admits fault by or imposes obligations on Provider without Provider's written consent.")

add_heading(doc, "12. Limitation of Liability", 1)
add_clause(doc, "12.1", "TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY WILL BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES, OR FOR LOST PROFITS, REVENUE, BUSINESS, GOODWILL, OR DATA, ARISING FROM THIS AGREEMENT, EVEN IF ADVISED OF THE POSSIBILITY.")
add_clause(doc, "12.2", "EXCEPT FOR CUSTOMER'S PAYMENT OBLIGATIONS, CUSTOMER'S BREACH OF SECTIONS 3, 4, 5, OR 6, EITHER PARTY'S FRAUD, WILLFUL MISCONDUCT, OR LIABILITY THAT CANNOT LAWFULLY BE LIMITED, EACH PARTY'S AGGREGATE LIABILITY ARISING FROM THIS AGREEMENT WILL NOT EXCEED THE GREATER OF FEES PAID OR PAYABLE UNDER THE PILOT OR ONE THOUSAND DOLLARS ($1,000).")

add_heading(doc, "13. Term and Termination", 1)
add_clause(doc, "13.1", "This Agreement begins on the Effective Date. The Pilot begins and ends on the dates in Exhibit A unless earlier terminated. Either Party may terminate the Pilot on three business days' written notice, or immediately for material breach, security risk, unlawful conduct, or misuse of Provider Technology.")
add_clause(doc, "13.2", "Upon termination, Customer and Authorized Users will stop using Prometheus IQ and delete or return Provider materials and credentials. Sections that by their nature should survive will survive, including Sections 4 through 8 and 10 through 19, together with accrued payment obligations.")

add_heading(doc, "14. Equitable Relief", 1)
add_clause(doc, "14.1", "Unauthorized use or disclosure of Provider Technology or a Party's Confidential Information may cause irreparable harm for which money damages are inadequate. Subject to applicable law, the injured Party may seek temporary, preliminary, and permanent injunctive or other equitable relief in addition to other remedies.")

add_heading(doc, "15. Compliance and Relationship", 1)
add_clause(doc, "15.1", "Each Party will comply with laws applicable to its performance. Nothing in this Agreement creates employment, agency, partnership, joint venture, fiduciary duty, franchise, or exclusivity. Neither Party may bind the other.")
add_clause(doc, "15.2", "Customer is solely responsible for employer approvals, compensation practices, workplace monitoring notices, solicitation permissions, and policies governing Customer's representatives and devices.")

add_heading(doc, "16. Governing Law and Disputes", 1)
add_clause(doc, "16.1", "Texas law governs this Agreement without regard to conflict-of-laws principles. Before filing suit, a Party will give written notice of the dispute and the Parties will attempt in good faith for 15 days to resolve it through a business meeting, except a Party may seek immediate equitable relief for threatened misuse of intellectual property, Confidential Information, or security credentials.")
add_clause(doc, "16.2", "The state and federal courts located in Harris County, Texas will have exclusive jurisdiction, and each Party consents to personal jurisdiction and venue there. EACH PARTY WAIVES TRIAL BY JURY TO THE MAXIMUM EXTENT PERMITTED BY LAW.")

add_heading(doc, "17. Notices", 1)
add_clause(doc, "17.1", "Legal notices must be in writing and sent to the contacts below by personal delivery, nationally recognized overnight courier, certified mail, or email with confirmation of receipt. Routine Pilot communications may occur by email.")
add_placeholder_table(doc, [
    ("Provider notice", "prometheusrouteiq@gmail.com; [MAILING ADDRESS]"),
    ("Customer notice", "[EMAIL]; [MAILING ADDRESS]"),
])

add_heading(doc, "18. General Terms", 1)
add_clause(doc, "18.1", "Customer may not assign this Agreement without Provider's prior written consent. Provider may assign it to a successor in connection with incorporation, reorganization, financing, merger, sale of substantially all assets, or transfer of Prometheus IQ, provided the successor assumes Provider's obligations.")
add_clause(doc, "18.2", "Neither Party is liable for delay caused by circumstances beyond its reasonable control, except payment, confidentiality, data-protection, and security-response obligations.")
add_clause(doc, "18.3", "This Agreement and its exhibits are the complete agreement about the Pilot and supersede prior discussions. If terms conflict, the body controls unless an exhibit expressly identifies the section it overrides. Amendments and waivers must be in a writing signed by authorized representatives. Failure to enforce a term is not a waiver.")
add_clause(doc, "18.4", "If a provision is unenforceable, it will be modified to the minimum extent necessary and the remainder will remain effective. Headings are for convenience. \"Including\" means \"including without limitation.\"")
add_clause(doc, "18.5", "This Agreement may be signed in counterparts and by electronic signature. Electronic copies and signatures are treated as originals to the extent permitted by law.")

add_heading(doc, "19. Protected Disclosures and Trade-Secret Immunity Notice", 1)
add_clause(doc, "19.1", "Nothing in this Agreement prohibits lawful reporting of suspected violations of law to a government official or attorney, participation in a government investigation, or other activity protected by law. No prior notice to or authorization from either Party is required for a protected report.")
add_clause(doc, "19.2", "Under 18 U.S.C. Section 1833(b), an individual will not be held criminally or civilly liable under federal or state trade-secret law for disclosing a trade secret: (a) in confidence to a federal, state, or local government official, directly or indirectly, or to an attorney, solely to report or investigate a suspected legal violation; or (b) in a complaint or other document filed under seal in a lawsuit or proceeding. An individual suing for retaliation may disclose a trade secret to the individual's attorney and use it in court if filings containing the trade secret are made under seal and disclosure occurs only as permitted by court order.")

add_heading(doc, "Signatures", 1)
add_body(doc, "The Parties intend to be legally bound as of the Effective Date.")

for party, name_line, title_line in [
    ("PROVIDER", "Cruz Garza, individually and doing business as Prometheus", "Founder"),
    ("CUSTOMER", "[FULL LEGAL NAME]", "By: [AUTHORIZED SIGNER NAME AND TITLE]"),
]:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(8)
    font_run(p.add_run(party), bold=True, color=BLUE)
    add_body(doc, name_line, after=12)
    add_body(doc, "Signature: __________________________________________", after=10)
    add_body(doc, title_line, after=10)
    add_body(doc, "Date: ______________________________________________", after=12)

# Exhibits
doc.add_page_break()
add_heading(doc, "Exhibit A - Pilot Order and Success Plan", 1)
add_body(doc, "Complete every field before Pilot access begins. If a field is not applicable, write \"Not Applicable.\"")
add_placeholder_table(doc, [
    ("Customer", "[FULL LEGAL NAME]"),
    ("Business objective", "[SPECIFIC FIELD-SALES OBJECTIVE]"),
    ("Pilot start", "[DATE]"),
    ("Pilot end", "[DATE; RECOMMENDED 14 DAYS]"),
    ("Decision meeting", "[DATE AND ATTENDEES]"),
    ("Authorized Users", "[NAMES, TITLES, EMAILS; 1-3 USERS]"),
    ("Locations/territory", "[DEFINED TERRITORY]"),
    ("Pilot fee", "[FREE DESIGN-PARTNER TEST OR AGREED FEE]"),
    ("Support", "[CHANNEL AND RESPONSE WINDOW]"),
    ("Approved features", "[QUICK RESULT, ROUTE, OWNER REPORTING, ETC.]"),
])

add_heading(doc, "Baseline and Success Measures", 2)
add_placeholder_table(doc, [
    ("Baseline period", "[DATES AND SOURCE]"),
    ("Primary metric", "[E.G., UNITS PER VISIT]"),
    ("Secondary metrics", "[VISITS, CONVERSATIONS, LEADS, UNITS/HOUR, UNITS/MILE]"),
    ("Adoption target", "[E.G., 90% OF COMPLETED STOPS LOGGED]"),
    ("Workflow target", "[E.G., MEDIAN QUICK RESULT UNDER 30 SECONDS]"),
    ("Minimum active days", "[E.G., 10 ACTIVE FIELD DAYS]"),
    ("Exclusions", "[VACATION, SYSTEM OUTAGE, NON-FIELD DAYS, ETC.]"),
    ("Data sources", "[PROMETHEUS IQ, APPROVED COMPANY REPORTS, ODOMETER, ETC.]"),
    ("Success threshold", "[PRE-AGREED THRESHOLD; NO POST-HOC CHANGES]"),
])

add_heading(doc, "Pilot-Specific Terms", 2)
add_body(doc, "[INSERT ONLY TERMS SPECIFIC TO THIS CUSTOMER. DO NOT MODIFY THE CORE AGREEMENT WITHOUT ATTORNEY REVIEW.]", italic=True)

doc.add_page_break()
add_heading(doc, "Exhibit B - Authorized User Acknowledgment", 1)
add_body(doc, "Each representative must sign before receiving access. This acknowledgment supplements, and does not replace, Customer's obligations under the Agreement.")
add_placeholder_table(doc, [
    ("Customer", "[FULL LEGAL NAME]"),
    ("Authorized User", "[FULL NAME AND TITLE]"),
    ("Work email", "[EMAIL]"),
    ("Pilot dates", "[START-END]"),
])
add_body(doc, "I acknowledge and agree that:")
add_clause(doc, "1.", "I will use Prometheus IQ only for the Customer-authorized Pilot and will follow the Agreement, Customer policies, and Provider instructions.")
add_clause(doc, "2.", "I will keep credentials, nonpublic demonstrations, screenshots, documentation, scoring outputs, route recommendations, and Provider methods confidential.")
add_clause(doc, "3.", "I will not reverse engineer, copy, probe, scrape, disclose, benchmark, circumvent, or use Prometheus IQ or its outputs to develop or improve a competing product.")
add_clause(doc, "4.", "I will enter only approved data and will not enter personal or sensitive information prohibited by Exhibit C.")
add_clause(doc, "5.", "I understand Prometheus IQ provides decision support only. I remain responsible for safe driving, permissions, lawful solicitation, accurate sales statements, and workplace conduct.")
add_clause(doc, "6.", "I will promptly report suspected loss of a device, credentials, Customer Data, or unauthorized access to the Customer and Provider contacts listed in Exhibit C.")
add_clause(doc, "7.", "My access ends when the Pilot ends, my work relationship changes, Customer or Provider revokes access, or I no longer need access.")
add_clause(doc, "8.", "Nothing in this acknowledgment restricts protected legal reporting or the trade-secret immunity rights described in Section 19 of the Agreement.")
add_body(doc, "Authorized User signature: ______________________________________________", after=10)
add_body(doc, "Printed name: _________________________________________________________", after=10)
add_body(doc, "Date: __________________________________________________________________", after=10)

doc.add_page_break()
add_heading(doc, "Exhibit C - Data, Security, Backup, and Deletion Schedule", 1)
add_heading(doc, "Permitted Pilot Data", 2)
add_clause(doc, "(a)", "Business names and business addresses approved for field activity.")
add_clause(doc, "(b)", "Aggregate counts of visits, conversations, leads, outcomes, and units.")
add_clause(doc, "(c)", "Time windows, route sequence, broad travel distance, permission status, and nonpersonal operational notes.")
add_clause(doc, "(d)", "Representative account name and work email when secure accounts are enabled.")

add_heading(doc, "Prohibited Unless Expressly Added Below", 2)
add_clause(doc, "(a)", "Consumer or prospect names, personal phone numbers, personal emails, payment information, credentials, government identifiers, health or biometric information, minors' data, or precise consumer geolocation.")
add_clause(doc, "(b)", "Confidential data from a CRM, customer list, employee file, or third-party system unless Customer is authorized to provide it and the Parties sign appropriate additional terms.")

add_placeholder_table(doc, [
    ("Hosting provider", "[PROVIDER AND REGION]"),
    ("Authentication", "[METHOD]"),
    ("Backup cadence", "[E.G., DAILY CLOUD BACKUP PLUS JSON EXPORT]"),
    ("Backup retention", "[DAYS]"),
    ("Pilot export", "[FORMAT AND DELIVERY METHOD]"),
    ("Active-data retention", "[DAYS AFTER PILOT]"),
    ("Deletion target", "[E.G., 30 DAYS AFTER WRITTEN REQUEST OR PILOT END]"),
    ("Provider incident contact", "prometheusrouteiq@gmail.com"),
    ("Customer incident contact", "[NAME, EMAIL, PHONE]"),
    ("Approved subprocessors", "[HOSTING, AUTH, EMAIL, MONITORING]"),
    ("Additional approved data", "[NONE UNLESS EXPRESSLY LISTED]"),
])

doc.add_page_break()
add_heading(doc, "Exhibit D - Optional Case Study and Testimonial Consent", 1)
add_body(doc, "This exhibit is optional and should be signed only after Customer reviews the final language and approved materials. Silence or participation in the Pilot is not consent.")
add_body(doc, "Customer authorizes only the checked uses below:")
add_clause(doc, "[  ]", "An anonymized case study that does not identify Customer, its personnel, or confidential metrics.")
add_clause(doc, "[  ]", "Use of Customer's name in an approved customer list.")
add_clause(doc, "[  ]", "Use of Customer's logo in the exact form provided by Customer.")
add_clause(doc, "[  ]", "The following approved testimonial: [INSERT EXACT QUOTE].")
add_clause(doc, "[  ]", "The following approved metrics and reporting period: [INSERT EXACT METRICS, DATES, AND LIMITATIONS].")
add_body(doc, "Approved channels: [WEBSITE / PITCH DECK / SOCIAL MEDIA / INVESTOR MATERIALS / OTHER]", after=10)
add_body(doc, "Consent expiration or withdrawal terms: [INSERT TERMS]", after=12)
add_body(doc, "Customer authorized signature: __________________________________________", after=10)
add_body(doc, "Name and title: ________________________________________________________", after=10)
add_body(doc, "Date: __________________________________________________________________", after=10)

doc.core_properties.title = "Prometheus IQ Pilot Evaluation, Confidentiality, Data Use, and Intellectual Property Protection Agreement"
doc.core_properties.subject = "Attorney-review draft for Prometheus IQ private pilots"
doc.core_properties.author = ""
doc.core_properties.last_modified_by = ""
doc.core_properties.comments = "Drafting aid only; attorney review required before use."

doc.save(OUTPUT)
print(OUTPUT)
