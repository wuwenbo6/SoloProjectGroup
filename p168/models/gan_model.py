import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
from PIL import Image, ImageDraw
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DEVICE, IMAGE_SIZE, GAN_LATENT_DIM, LEARNING_RATE, BETA1, DEFECT_TYPES


class Generator(nn.Module):
    def __init__(self, latent_dim=GAN_LATENT_DIM, img_channels=1):
        super(Generator, self).__init__()
        self.init_size = IMAGE_SIZE // 16
        self.l1 = nn.Sequential(nn.Linear(latent_dim, 128 * self.init_size ** 2))

        self.conv_blocks = nn.Sequential(
            nn.BatchNorm2d(128),
            nn.Upsample(scale_factor=2),
            nn.Conv2d(128, 128, 3, stride=1, padding=1),
            nn.BatchNorm2d(128, 0.8),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Upsample(scale_factor=2),
            nn.Conv2d(128, 64, 3, stride=1, padding=1),
            nn.BatchNorm2d(64, 0.8),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Upsample(scale_factor=2),
            nn.Conv2d(64, 32, 3, stride=1, padding=1),
            nn.BatchNorm2d(32, 0.8),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Upsample(scale_factor=2),
            nn.Conv2d(32, img_channels, 3, stride=1, padding=1),
            nn.Tanh(),
        )

    def forward(self, z):
        out = self.l1(z)
        out = out.view(out.shape[0], 128, self.init_size, self.init_size)
        img = self.conv_blocks(out)
        return img


class Discriminator(nn.Module):
    def __init__(self, img_channels=1):
        super(Discriminator, self).__init__()

        def discriminator_block(in_filters, out_filters, bn=True):
            block = [nn.Conv2d(in_filters, out_filters, 3, 2, 1), nn.LeakyReLU(0.2, inplace=True), nn.Dropout2d(0.25)]
            if bn:
                block.append(nn.BatchNorm2d(out_filters, 0.8))
            return block

        self.model = nn.Sequential(
            *discriminator_block(img_channels, 16, bn=False),
            *discriminator_block(16, 32),
            *discriminator_block(32, 64),
            *discriminator_block(64, 128),
        )

        ds_size = IMAGE_SIZE // 2 ** 4
        self.adv_layer = nn.Sequential(nn.Linear(128 * ds_size ** 2, 1), nn.Sigmoid())

    def forward(self, img):
        out = self.model(img)
        out = out.view(out.shape[0], -1)
        validity = self.adv_layer(out)
        return validity


class WaferDefectDataset(Dataset):
    def __init__(self, num_samples=1000, img_size=IMAGE_SIZE):
        self.num_samples = num_samples
        self.img_size = img_size
        self.defect_types = DEFECT_TYPES[:-1]

    def __len__(self):
        return self.num_samples

    def _generate_scratch(self, draw):
        start_x = np.random.randint(0, self.img_size)
        start_y = np.random.randint(0, self.img_size)
        end_x = np.random.randint(0, self.img_size)
        end_y = np.random.randint(0, self.img_size)
        width = np.random.randint(1, 5)
        draw.line([(start_x, start_y), (end_x, end_y)], fill=0, width=width)

    def _generate_particle(self, draw):
        x = np.random.randint(0, self.img_size)
        y = np.random.randint(0, self.img_size)
        radius = np.random.randint(2, 10)
        draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=0)

    def _generate_contamination(self, draw):
        x = np.random.randint(0, self.img_size)
        y = np.random.randint(0, self.img_size)
        for _ in range(np.random.randint(5, 20)):
            dx = np.random.randint(-15, 15)
            dy = np.random.randint(-15, 15)
            radius = np.random.randint(1, 4)
            draw.ellipse([x+dx-radius, y+dy-radius, x+dx+radius, y+dy+radius], fill=0)

    def _generate_crack(self, draw):
        x = np.random.randint(0, self.img_size)
        y = np.random.randint(0, self.img_size)
        points = [(x, y)]
        for _ in range(np.random.randint(3, 8)):
            x += np.random.randint(-20, 20)
            y += np.random.randint(-20, 20)
            x = max(0, min(self.img_size-1, x))
            y = max(0, min(self.img_size-1, y))
            points.append((x, y))
        draw.line(points, fill=0, width=1)

    def __getitem__(self, idx):
        img = Image.new('L', (self.img_size, self.img_size), color=200)
        draw = ImageDraw.Draw(img)
        
        for _ in range(np.random.randint(30, 100)):
            x = np.random.randint(0, self.img_size)
            y = np.random.randint(0, self.img_size)
            noise = np.random.randint(-20, 20)
            draw.point((x, y), fill=max(0, min(255, 200 + noise)))

        defect_type = np.random.choice(self.defect_types)
        if defect_type == 'scratch':
            self._generate_scratch(draw)
        elif defect_type == 'particle':
            for _ in range(np.random.randint(1, 5)):
                self._generate_particle(draw)
        elif defect_type == 'contamination':
            self._generate_contamination(draw)
        elif defect_type == 'crack':
            self._generate_crack(draw)

        img_array = np.array(img, dtype=np.float32) / 127.5 - 1.0
        return torch.from_numpy(img_array).unsqueeze(0)


def train_gan(num_epochs=50, batch_size=16):
    adversarial_loss = nn.BCELoss()
    generator = Generator().to(DEVICE)
    discriminator = Discriminator().to(DEVICE)
    
    optimizer_G = optim.Adam(generator.parameters(), lr=LEARNING_RATE, betas=(BETA1, 0.999))
    optimizer_D = optim.Adam(discriminator.parameters(), lr=LEARNING_RATE, betas=(BETA1, 0.999))

    dataset = WaferDefectDataset(num_samples=2000)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    for epoch in range(num_epochs):
        for i, imgs in enumerate(dataloader):
            batch_size = imgs.shape[0]
            valid = torch.ones(batch_size, 1).to(DEVICE)
            fake = torch.zeros(batch_size, 1).to(DEVICE)

            real_imgs = imgs.to(DEVICE)

            optimizer_G.zero_grad()
            z = torch.randn(batch_size, GAN_LATENT_DIM).to(DEVICE)
            gen_imgs = generator(z)
            g_loss = adversarial_loss(discriminator(gen_imgs), valid)
            g_loss.backward()
            optimizer_G.step()

            optimizer_D.zero_grad()
            real_loss = adversarial_loss(discriminator(real_imgs), valid)
            fake_loss = adversarial_loss(discriminator(gen_imgs.detach()), fake)
            d_loss = (real_loss + fake_loss) / 2
            d_loss.backward()
            optimizer_D.step()

            if i % 50 == 0:
                print(f"[Epoch {epoch}/{num_epochs}] [Batch {i}/{len(dataloader)}] [D loss: {d_loss.item():.4f}] [G loss: {g_loss.item():.4f}]")

    return generator, discriminator


def generate_defect_samples(generator, num_samples=10, save_dir=None):
    generator.eval()
    with torch.no_grad():
        z = torch.randn(num_samples, GAN_LATENT_DIM).to(DEVICE)
        gen_imgs = generator(z)
        
    gen_imgs = (gen_imgs + 1) / 2 * 255
    gen_imgs = gen_imgs.cpu().numpy().astype(np.uint8)
    
    if save_dir:
        os.makedirs(save_dir, exist_ok=True)
        for i, img in enumerate(gen_imgs):
            Image.fromarray(img[0], mode='L').save(os.path.join(save_dir, f"defect_{i}.png"))
    
    return gen_imgs


if __name__ == "__main__":
    print("Training GAN for wafer defect generation...")
    generator, discriminator = train_gan(num_epochs=20)
    torch.save(generator.state_dict(), "generator.pth")
    torch.save(discriminator.state_dict(), "discriminator.pth")
    print("GAN training completed.")
