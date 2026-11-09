import os
import cv2
import numpy as np
from PIL import Image

src_image = r"C:\Users\18755\.gemini\antigravity-ide\brain\ebd3bfc1-84c5-4715-9165-1806d1053fad\traveler_v2_1786035367054.png"
output_dir = r"d:\Project\ai-tavern\public\characters"
os.makedirs(output_dir, exist_ok=True)

if os.path.exists(src_image):
    img = Image.open(src_image).convert("RGBA")
    data = np.array(img)
    
    # Extract RGB channels
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    
    # White background mask condition (near pure white)
    white_mask = (r > 230) & (g > 230) & (b > 230)
    
    # Set alpha channel to transparent where white_mask is True
    a[white_mask] = 0
    
    # Soft edge feathering / matting for smooth cutout
    data[:,:,3] = a
    
    result = Image.fromarray(data)
    
    # Save main portrait (traveler.png)
    main_path = os.path.join(output_dir, "traveler.png")
    result.save(main_path, "PNG")
    print(f"✅ Saved transparent main cutout to {main_path}")
