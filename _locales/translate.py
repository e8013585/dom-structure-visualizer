import os
import json
import time
from deep_translator import GoogleTranslator

def main():
    en_path = os.path.join('en', 'messages.json')
    if not os.path.exists(en_path):
        print("Error: Could not find en/messages.json")
        return
        
    with open(en_path, 'r', encoding='utf-8') as f:
        en_messages = json.load(f)

    # Map Chrome locale codes to Google Translate locale codes
    lang_map = {
        "fil": "tl",   # Tagalog/Filipino
        "he": "iw",    # Hebrew
    }

    # Loop through all folders in the current directory
    for folder in os.listdir('.'):
        if not os.path.isdir(folder) or folder in ['en', '__pycache__', '.git']:
            continue
            
        # Google Translate uses dashes instead of underscores (e.g., zh-CN instead of zh_CN)
        target_lang = lang_map.get(folder, folder.replace('_', '-'))
        print(f"\nTranslating for {folder}...")
        
        translated_messages = {}
        
        try:
            translator = GoogleTranslator(source='en', target=target_lang)
            
            for key, value_obj in en_messages.items():
                original_text = value_obj['message']
                description = value_obj.get('description', '')
                
                translated_text = translator.translate(original_text)
                
                translated_messages[key] = {
                    "message": translated_text,
                    "description": description
                }
                
                # Small pause to avoid hitting free API limits
                time.sleep(0.1) 
                
            output_path = os.path.join(folder, 'messages.json')
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(translated_messages, f, ensure_ascii=False, indent=2)
                
            print(f"✅ Saved to: {output_path}")
            
        except Exception as e:
            print(f"❌ Error translating {folder}: {e}")

if __name__ == '__main__':
    main()
