#!/usr/bin/env python3
"""
iOS 앱 아이콘 생성 스크립트
- 흰색 여백 자동 제거
- iOS 앱 아이콘 모든 사이즈 생성
"""

from PIL import Image
import os

# iOS 앱 아이콘 사이즈 정의
IOS_ICON_SIZES = [
    ("AppIcon-1024.png", 1024),  # App Store
    ("AppIcon-180.png", 180),    # iPhone 3x
    ("AppIcon-167.png", 167),    # iPad Pro
    ("AppIcon-152.png", 152),    # iPad 2x
    ("AppIcon-120.png", 120),    # iPhone 2x, iPhone 3x (40x40)
    ("AppIcon-87.png", 87),      # iPhone 3x (29x29)
    ("AppIcon-80.png", 80),      # iPhone 2x (40x40), iPad 2x (40x40)
    ("AppIcon-76.png", 76),      # iPad 1x
    ("AppIcon-60.png", 60),      # iPhone 1x
    ("AppIcon-58.png", 58),      # iPhone 2x (29x29), iPad 2x (29x29)
    ("AppIcon-40.png", 40),      # iPhone 1x, iPad 1x
    ("AppIcon-29.png", 29),      # iPhone 1x, iPad 1x
    ("AppIcon-20.png", 20),      # iPhone 1x, iPad 1x
]

def remove_white_padding(image_path):
    """흰색 여백 제거"""
    img = Image.open(image_path)

    # RGBA 모드로 변환
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # 이미지 데이터 가져오기
    pixels = img.load()
    width, height = img.size

    # 흰색/회색 여백 감지 (RGB 값이 240 이상인 픽셀)
    min_x, min_y = width, height
    max_x, max_y = 0, 0

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # 흰색이 아닌 픽셀 찾기 (RGB 값이 240 미만)
            if r < 240 or g < 240 or b < 240:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    # 여백 제거된 이미지 크롭
    if max_x > min_x and max_y > min_y:
        cropped = img.crop((min_x, min_y, max_x + 1, max_y + 1))
        print(f"✂️  원본 크기: {width}x{height}")
        print(f"✂️  크롭 영역: ({min_x}, {min_y}) - ({max_x}, {max_y})")
        print(f"✂️  크롭 크기: {cropped.size[0]}x{cropped.size[1]}")
        return cropped
    else:
        print("⚠️  여백을 찾을 수 없습니다. 원본 이미지 사용")
        return img

def generate_ios_icons(source_image_path, output_dir):
    """iOS 앱 아이콘 생성"""
    print(f"\n📱 iOS 앱 아이콘 생성 시작")
    print(f"📂 출력 디렉토리: {output_dir}")

    # 출력 디렉토리 생성
    os.makedirs(output_dir, exist_ok=True)

    # 흰색 여백 제거
    print(f"\n🖼️  이미지 로드: {source_image_path}")
    base_image = remove_white_padding(source_image_path)

    # 정사각형으로 만들기 (가장 긴 변 기준)
    max_size = max(base_image.size)
    square_image = Image.new('RGBA', (max_size, max_size), (255, 255, 255, 0))

    # 중앙 정렬
    x_offset = (max_size - base_image.size[0]) // 2
    y_offset = (max_size - base_image.size[1]) // 2
    square_image.paste(base_image, (x_offset, y_offset), base_image)

    print(f"\n✅ 정사각형 이미지 생성: {max_size}x{max_size}")

    # 각 사이즈별 아이콘 생성
    print(f"\n🎨 아이콘 사이즈 생성 중...")
    for filename, size in IOS_ICON_SIZES:
        resized = square_image.resize((size, size), Image.Resampling.LANCZOS)
        output_path = os.path.join(output_dir, filename)

        # PNG로 저장
        resized.save(output_path, 'PNG', optimize=True)
        print(f"  ✓ {filename} ({size}x{size})")

    print(f"\n✅ 총 {len(IOS_ICON_SIZES)}개 아이콘 생성 완료!")
    return True

def main():
    # 경로 설정
    source_image = "/Users/munkyo/works/ai-code/BS/run-port/app-icon.png"
    output_dir = "/Users/munkyo/works/ai-code/BS/run-port/ios/RunPort/Images.xcassets/AppIcon.appiconset"

    # 아이콘 생성
    generate_ios_icons(source_image, output_dir)

if __name__ == "__main__":
    main()
