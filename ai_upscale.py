#!/usr/bin/env python3
import argparse, os, sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--scale', type=int, choices=[2,4], default=2)
    args = ap.parse_args()

    try:
        import torch
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer
    except Exception as e:
        print('AI_ENGINE_NOT_INSTALLED: ' + str(e), file=sys.stderr)
        return 20

    root = Path(__file__).resolve().parent
    model_dir = root / 'models'
    model_dir.mkdir(exist_ok=True)
    model_path = model_dir / 'RealESRGAN_x4plus.pth'
    if not model_path.exists():
        import urllib.request
        url = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/RealESRGAN_x4plus.pth'
        try:
            print('Downloading RealESRGAN_x4plus model...', file=sys.stderr)
            urllib.request.urlretrieve(url, model_path)
        except Exception as e:
            print('MODEL_DOWNLOAD_FAILED: ' + str(e), file=sys.stderr)
            return 21

    # Real-ESRGAN x4 model. For 2x, produce 4x then downsample to exact 2x.
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    use_half = bool(torch.cuda.is_available())
    upsampler = RealESRGANer(
        scale=4,
        model_path=str(model_path),
        model=model,
        tile=256,
        tile_pad=10,
        pre_pad=0,
        half=use_half,
    )

    import cv2
    import numpy as np
    img = cv2.imread(args.input, cv2.IMREAD_UNCHANGED)
    if img is None:
        print('INPUT_READ_FAILED', file=sys.stderr)
        return 22
    try:
        output, _ = upsampler.enhance(img, outscale=4)
        if args.scale == 2:
            h, w = img.shape[:2]
            output = cv2.resize(output, (w*2, h*2), interpolation=cv2.INTER_AREA)
        ok = cv2.imwrite(args.output, output)
        if not ok:
            print('OUTPUT_WRITE_FAILED', file=sys.stderr)
            return 23
    except Exception as e:
        print('AI_UPSCALE_FAILED: ' + str(e), file=sys.stderr)
        return 24
    print(f'AI_OK scale={args.scale} output={args.output}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
