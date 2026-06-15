import os
import glob
import re

frontend_dir = 'f:/pythonadnan/minddeploy/frontend/src'
for filepath in glob.glob(frontend_dir + '/**/*.tsx', recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'http://127.0.0.1:8000' in content:
        # handle literal quotes
        content = re.sub(r"'http://127.0.0.1:8000/([^']*)'", r"`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/\1`", content)
        content = re.sub(r'"http://127.0.0.1:8000/([^"]*)"', r"`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/\1`", content)
        content = content.replace("'http://127.0.0.1:8000'", "(import.meta.env.VITE_API_URL || 'http://localhost:8000')")
        content = content.replace('"http://127.0.0.1:8000"', "(import.meta.env.VITE_API_URL || 'http://localhost:8000')")
        
        # handle backticks (template literals)
        content = content.replace("`http://127.0.0.1:8000/", "`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
