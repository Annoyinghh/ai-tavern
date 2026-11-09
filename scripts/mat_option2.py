import os
import numpy as np
from PIL import Image
import cv2

src_path = r"C:\Users\18755\.gemini\antigravity-ide\brain\ebd3bfc1-84c5-4715-9165-1806d1053fad\old_tom_option_2.png"
dest_png = r"d:\Project\ai-tavern\public\characters\old_tom.png"

if os.path.exists(src_path):
    img = Image.open(src_path).convert("RGBA")
    arr = np.array(img)
    h, w, _ = arr.shape
    
    bgr = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_RGB2BGR)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    # Floodfill background from outer edges
    for x in range(0, w, 15):
        cv2.floodFill(bgr, mask, (x, 0), (0, 0, 0), (40, 40, 40), (40, 40, 40), flags)
        cv2.floodFill(bgr, mask, (x, 50), (0, 0, 0), (40, 40, 40), (40, 40, 40), flags)
    for y in range(0, int(h * 0.7), 15):
        cv2.floodFill(bgr, mask, (0, y), (0, 0, 0), (40, 40, 40), (40, 40, 40), flags)
        cv2.floodFill(bgr, mask, (w - 1, y), (0, 0, 0), (40, 40, 40), (40, 40, 40), flags)
        
    bg_mask = mask[1:-1, 1:-1] > 0
    arr[bg_mask, 3] = 0
    
    res = Image.fromarray(arr)
    res.save(dest_png, "PNG")
    print(f"Successfully extracted figure to {dest_png}")
