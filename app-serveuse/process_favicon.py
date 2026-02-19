from PIL import Image, ImageDraw
import sys

def process_favicon(input_path, output_path):
    try:
        # Load the image
        img = Image.open(input_path).convert("RGBA")
        
        # 1. Crop transparent borders (to maximize size)
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        
        # 2. Create a square background (white)
        # Determine size: max(width, height) + padding
        max_dim = max(img.width, img.height)
        padding = int(max_dim * 0.1) # 10% padding
        new_size = max_dim + 2 * padding
        
        # Create new image with white background
        bg = Image.new("RGBA", (new_size, new_size), (255, 255, 255, 255))
        
        # Paste the cropped icon in the center
        paste_x = (new_size - img.width) // 2
        paste_y = (new_size - img.height) // 2
        
        bg.paste(img, (paste_x, paste_y), img)
        
        # Save
        bg.save(output_path, "PNG")
        print(f"Successfully processed favicon: {output_path}")
        
    except Exception as e:
        print(f"Error processing favicon: {e}")
        sys.exit(1)

if __name__ == "__main__":
    process_favicon(
        "/Users/gabrielguelieko/Documents/Verrouillage/Branding/Untitled.png",
        "favicon_fixed.png"
    )
