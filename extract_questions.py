#!/usr/bin/env python3
"""Robust MCQ extractor for Fuzzy Logic assignment PDFs - v3."""

import pdfplumber
import json
import re
import os

def extract_text_from_pdf(pdf_path):
    """Extract all text from a PDF."""
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
    return full_text

def deduplicate_line(line):
    """Fix OCR-doubled text like 'TThhee' -> 'The' or tripled 'TTThhheee' -> 'The'."""
    if len(line) < 6:
        return line
    
    # Try tripled first
    for n in [3, 2]:
        result = ""
        valid = True
        i = 0
        while i < len(line):
            if line[i] == ' ':
                result += ' '
                i += 1
                continue
            # Check if next n chars are the same
            if i + n - 1 < len(line) and all(line[i+k] == line[i] for k in range(1, n)):
                result += line[i]
                i += n
            elif i + 1 < len(line) and line[i] == line[i+1] and n == 3:
                # Allow mixed 2/3 repetitions in tripled mode
                result += line[i]
                i += 2
            else:
                valid = False
                break
        
        if valid and len(result) > 3 and len(result) < len(line) * 0.7:
            return result
    
    return line

def clean_text(text):
    """Clean extracted text."""
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        cl = deduplicate_line(line)
        cleaned.append(cl)
    result = '\n'.join(cleaned)
    # Remove (cid:XXXX) PDF artifacts
    result = re.sub(r'\(cid:\d+\)', '', result)
    return result

def parse_questions_robust(text, assignment_num):
    """Parse MCQ questions with robust multi-format support."""
    questions = []
    
    # Clean text
    text = clean_text(text)
    
    # Normalize option markers: (A) -> (a), etc.
    for u, l in [('(A)', '(a)'), ('(B)', '(b)'), ('(C)', '(c)'), ('(D)', '(d)'), ('(E)', '(e)')]:
        text = text.replace(u, l)
    
    # Normalize answer markers
    text = re.sub(r'\b(Answer|Ans|Correct Answer)\s*:', 'Solution:', text, flags=re.IGNORECASE)
    
    # Split text into question blocks using Q.N or QN pattern
    # Find all question start positions
    q_starts = list(re.finditer(r'(?:^|\n)\s*Q\.?\s*(\d+)\s*[\.\:\)]\s*', text))
    
    for idx, match in enumerate(q_starts):
        q_num = int(match.group(1))
        start = match.end()
        
        # End is start of next question or end of text
        if idx + 1 < len(q_starts):
            end = q_starts[idx + 1].start()
        else:
            end = len(text)
        
        block = text[start:end].strip()
        
        if not block:
            continue
        
        # Find all option positions in this block
        opt_matches = list(re.finditer(r'\n\s*\(([a-e])\)\s*', '\n' + block))
        
        if len(opt_matches) < 2:
            # Try without newline
            opt_matches = list(re.finditer(r'\(([a-e])\)\s*', block))
            if len(opt_matches) < 2:
                continue
            use_newline_prefix = False
        else:
            use_newline_prefix = True
        
        # Question text is before first option
        if use_newline_prefix:
            question_text = ('\n' + block)[:opt_matches[0].start()].strip()
        else:
            question_text = block[:opt_matches[0].start()].strip()
        
        # Find solution line position in block
        sol_match = re.search(r'\n?\s*Solution\s*:\s*\(?([a-e](?:\s*(?:and|,|&)\s*\(?[a-e]\)?)*)\)?', block, re.IGNORECASE)
        
        if not sol_match:
            continue
        
        sol_pos = sol_match.start()
        correct_text = sol_match.group(1).strip()
        correct_answers = re.findall(r'[a-e]', correct_text)
        
        if not correct_answers:
            continue
        
        # Extract options - each option text goes from its match end to the next option/solution start
        options = {}
        for oi, om in enumerate(opt_matches):
            opt_letter = om.group(1)
            opt_start = om.end()
            
            # Option ends at next option, solution line, or end of last option before solution
            if oi + 1 < len(opt_matches):
                opt_end = opt_matches[oi + 1].start()
            else:
                # Last option ends at solution line
                if use_newline_prefix:
                    opt_end = sol_pos + 1  # +1 because we added \n prefix
                else:
                    opt_end = sol_pos
            
            if use_newline_prefix:
                opt_text = ('\n' + block)[opt_start:opt_end].strip()
            else:
                opt_text = block[opt_start:opt_end].strip()
            
            # Remove any trailing solution marker from option text
            sol_in_opt = re.search(r'\n?\s*Solution\s*:', opt_text)
            if sol_in_opt:
                opt_text = opt_text[:sol_in_opt.start()].strip()
            
            # Clean up
            opt_text = re.sub(r'\s+', ' ', opt_text).strip()
            
            if opt_text:
                options[opt_letter] = opt_text
        
        if len(options) < 2:
            continue
        
        # Extract explanation - everything after solution line
        explanation = ""
        after_sol = block[sol_match.end():].strip()
        if after_sol and len(after_sol) > 5:
            # Clean up the explanation
            explanation = re.sub(r'\s+', ' ', after_sol).strip()
            # Truncate very long math-heavy explanations
            if len(explanation) > 800:
                explanation = explanation[:800] + "..."
        
        if not explanation or len(explanation) < 10:
            explanation = ""
        
        # Clean question text
        question_text = re.sub(r'\s+', ' ', question_text).strip()
        
        question = {
            "id": f"a{assignment_num}_q{q_num}",
            "assignment": assignment_num,
            "question_number": q_num,
            "question": question_text,
            "options": options,
            "correct_answers": correct_answers,
            "explanation": explanation
        }
        questions.append(question)
    
    return questions

def fix_truncations(data):
    """Fix common option text truncations from PDF extraction."""
    # Common suffix fixes
    suffix_fixes = {
        'None of the abov': 'None of the above',
        'All of the abov': 'All of the above',
        'determined by sigm': 'determined by sigma',
        'tain triangular shap': 'tain triangular shape',
        'To ensure symmetr': 'To ensure symmetry',
        'exivity and asymmetr': 'exivity and asymmetry',
        'all rows and column': 'all rows and columns',
        'roperty to compensat': 'roperty to compensate',
        'ations in fuzzy logi': 'ations in fuzzy logic',
        'rform fuzzy inferenc': 'rform fuzzy inference',
        'across new dimensio': 'across new dimensions',
        'Drastic produc': 'Drastic product',
        'Completenes': 'Completeness',
        'Non-decreasin': 'Non-decreasing',
    }
    
    count = 0
    for q in data:
        for key in q['options']:
            for old, new in suffix_fixes.items():
                if q['options'][key].endswith(old):
                    q['options'][key] = q['options'][key][:-len(old)] + new
                    count += 1
        # Fix question text too
        for old, new in suffix_fixes.items():
            if q['question'].endswith(old):
                q['question'] = q['question'][:-len(old)] + new
                count += 1
    
    return count

def main():
    all_questions = []
    
    for i in range(1, 13):
        pdf_path = f"pdfs/assignment_{i}.pdf"
        if not os.path.exists(pdf_path):
            print(f"WARNING: {pdf_path} not found!")
            continue
        
        print(f"Processing Assignment {i}...")
        text = extract_text_from_pdf(pdf_path)
        
        questions = parse_questions_robust(text, i)
        print(f"  Found {len(questions)} questions")
        
        # Count explanations
        with_expl = sum(1 for q in questions if not q['explanation'].startswith('The correct answer'))
        print(f"  With explanations: {with_expl}/{len(questions)}")
        
        if questions:
            q = questions[0]
            print(f"  Sample: Q{q['question_number']}: {q['question'][:80]}...")
            print(f"  Correct: {q['correct_answers']}")
        
        all_questions.extend(questions)
    
    # Fix truncations
    fixes = fix_truncations(all_questions)
    print(f"\nFixed {fixes} truncated texts")
    print(f"Total questions: {len(all_questions)}")
    
    # Save JSON
    with open("questions.json", "w", encoding="utf-8") as f:
        json.dump(all_questions, f, indent=2, ensure_ascii=False)
    
    # Save JS
    with open("questions.js", "w", encoding="utf-8") as f:
        f.write("// Auto-generated from PDF extraction - Fuzzy Logic Assignments 1-12\n")
        f.write("const QUESTIONS_DATA = ")
        json.dump(all_questions, f, indent=2, ensure_ascii=False)
        f.write(";\n")
    
    print("Saved questions.json and questions.js")

if __name__ == "__main__":
    main()
