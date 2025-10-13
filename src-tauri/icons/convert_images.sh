#!/bin/bash

# 源图片
SOURCE_IMAGE="Gemini_Generated_Image_6gnqcu6gnqcu6gnq.png"
# 备份目录
BACKUP_DIR="backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 处理PNG文件
for file in *.png; do
    if [ "$file" != "$SOURCE_IMAGE" ]; then
        echo "Processing $file..."
        # 获取原始尺寸
        dimensions=$(identify -format "%wx%h" "$file" 2>/dev/null)
        if [ $? -eq 0 ]; then
            # 备份原文件
            cp "$file" "$BACKUP_DIR/"
            # 转换图片
            ffmpeg -y -i "$SOURCE_IMAGE" -vf "scale=${dimensions}" -q:v 2 "$file"
            echo "Converted $file to $dimensions"
        else
            echo "Skipping $file - could not get dimensions"
        fi
    fi
done

# 处理ICO文件
for file in *.ico; do
    echo "Processing $file..."
    # 获取ICO文件中的图片尺寸
    dimensions=$(identify -format "%wx%h" "$file[0]" 2>/dev/null)
    if [ $? -eq 0 ]; then
        # 备份原文件
        cp "$file" "$BACKUP_DIR/"
        # 创建临时目录
        TEMP_DIR=$(mktemp -d)
        # 转换图片为PNG
        ffmpeg -y -i "$SOURCE_IMAGE" -vf "scale=${dimensions}" -q:v 2 "$TEMP_DIR/icon.png"
        # 转换回ICO
        convert "$TEMP_DIR/icon.png" -define icon:auto-resize "$file"
        # 清理临时文件
        rm -rf "$TEMP_DIR"
        echo "Converted $file to $dimensions"
    else
        echo "Skipping $file - could not get dimensions"
    fi
done

echo "All done! Original files are backed up in $BACKUP_DIR"
