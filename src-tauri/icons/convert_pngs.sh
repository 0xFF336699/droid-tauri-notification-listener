#!/bin/bash

# 源图片
SOURCE_IMAGE="Gemini_Generated_Image_6gnqcu6gnqcu6gnq.png"
# 备份目录
BACKUP_DIR="backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 只处理PNG文件
for file in *.png; do
    if [ "$file" != "$SOURCE_IMAGE" ]; then
        echo "Processing $file..."
        # 获取原始尺寸（使用ffprobe）
        dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$file" 2>/dev/null)
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

echo "PNG conversion complete! Original files are backed up in $BACKUP_DIR"
