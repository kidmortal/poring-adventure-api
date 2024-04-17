import { Image, createCanvas } from 'canvas';
import * as fs from 'fs';

async function loadImageUrl(url: string): Promise<Image> {
  const img = new Image();
  img.src = url;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });
  return img;
}

async function drawImage(args: { headUrl: string; bodyUrl: string }) {
  const width = 70;
  const height = 120;

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const head = await loadImageUrl(args.headUrl);
  const body = await loadImageUrl(args.bodyUrl);

  context.drawImage(body, 0, 42, 70, 70);
  context.drawImage(head, 0, 0, 70, 70);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('./image.png', buffer);
}

export const ImageDrawerService = {
  drawImage,
};
