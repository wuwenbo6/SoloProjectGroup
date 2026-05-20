import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchvision.models as models
from torchvision import transforms
import numpy as np
from PIL import Image, ImageDraw
import cv2
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DEVICE, IMAGE_SIZE, NUM_CLASSES, DEFECT_TYPES, LEARNING_RATE


class BasicBlock(nn.Module):
    expansion = 1

    def __init__(self, in_channels, out_channels, stride=1, downsample=None):
        super(BasicBlock, self).__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, stride=1, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_channels)
        self.downsample = downsample

    def forward(self, x):
        identity = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)

        out = self.conv2(out)
        out = self.bn2(out)

        if self.downsample is not None:
            identity = self.downsample(x)

        out += identity
        out = self.relu(out)

        return out


class ResNet(nn.Module):
    def __init__(self, block, layers, num_classes=NUM_CLASSES, grayscale=True):
        super(ResNet, self).__init__()
        self.in_channels = 64
        input_channels = 1 if grayscale else 3

        self.conv1 = nn.Conv2d(input_channels, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        self.layer1 = self._make_layer(block, 64, layers[0])
        self.layer2 = self._make_layer(block, 128, layers[1], stride=2)
        self.layer3 = self._make_layer(block, 256, layers[2], stride=2)
        self.layer4 = self._make_layer(block, 512, layers[3], stride=2)

        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(512 * block.expansion, num_classes)

        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def _make_layer(self, block, out_channels, blocks, stride=1):
        downsample = None
        if stride != 1 or self.in_channels != out_channels * block.expansion:
            downsample = nn.Sequential(
                nn.Conv2d(self.in_channels, out_channels * block.expansion, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(out_channels * block.expansion),
            )

        layers = []
        layers.append(block(self.in_channels, out_channels, stride, downsample))
        self.in_channels = out_channels * block.expansion
        for _ in range(1, blocks):
            layers.append(block(self.in_channels, out_channels))

        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        x = self.avgpool(x)
        features = torch.flatten(x, 1)
        x = self.fc(features)

        return x, features


def resnet18(num_classes=NUM_CLASSES, grayscale=True):
    return ResNet(BasicBlock, [2, 2, 2, 2], num_classes=num_classes, grayscale=grayscale)


class WaferDataset(Dataset):
    def __init__(self, num_samples=1000, img_size=IMAGE_SIZE, transform=None):
        self.num_samples = num_samples
        self.img_size = img_size
        self.transform = transform
        self.defect_types = DEFECT_TYPES

    def __len__(self):
        return self.num_samples

    def _add_scratch(self, draw):
        start_x = np.random.randint(0, self.img_size)
        start_y = np.random.randint(0, self.img_size)
        end_x = np.random.randint(0, self.img_size)
        end_y = np.random.randint(0, self.img_size)
        width = np.random.randint(1, 5)
        draw.line([(start_x, start_y), (end_x, end_y)], fill=0, width=width)
        return [(min(start_x, end_x), min(start_y, end_y), abs(end_x-start_x), abs(end_y-start_y))]

    def _add_particle(self, draw):
        bboxes = []
        for _ in range(np.random.randint(1, 5)):
            x = np.random.randint(0, self.img_size)
            y = np.random.randint(0, self.img_size)
            radius = np.random.randint(2, 10)
            draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=0)
            bboxes.append((x-radius, y-radius, 2*radius, 2*radius))
        return bboxes

    def _add_contamination(self, draw):
        x = np.random.randint(0, self.img_size)
        y = np.random.randint(0, self.img_size)
        for _ in range(np.random.randint(5, 20)):
            dx = np.random.randint(-15, 15)
            dy = np.random.randint(-15, 15)
            radius = np.random.randint(1, 4)
            draw.ellipse([x+dx-radius, y+dy-radius, x+dx+radius, y+dy+radius], fill=0)
        return [(x-20, y-20, 40, 40)]

    def _add_crack(self, draw):
        x = np.random.randint(0, self.img_size)
        y = np.random.randint(0, self.img_size)
        points = [(x, y)]
        min_x, max_x = x, x
        min_y, max_y = y, y
        for _ in range(np.random.randint(3, 8)):
            x += np.random.randint(-20, 20)
            y += np.random.randint(-20, 20)
            x = max(0, min(self.img_size-1, x))
            y = max(0, min(self.img_size-1, y))
            points.append((x, y))
            min_x, max_x = min(min_x, x), max(max_x, x)
            min_y, max_y = min(min_y, y), max(max_y, y)
        draw.line(points, fill=0, width=1)
        return [(min_x, min_y, max_x-min_x, max_y-min_y)]

    def __getitem__(self, idx):
        img = Image.new('L', (self.img_size, self.img_size), color=200)
        draw = ImageDraw.Draw(img)

        for _ in range(np.random.randint(30, 100)):
            x = np.random.randint(0, self.img_size)
            y = np.random.randint(0, self.img_size)
            noise = np.random.randint(-20, 20)
            draw.point((x, y), fill=max(0, min(255, 200 + noise)))

        defect_idx = np.random.randint(0, len(self.defect_types))
        defect_type = self.defect_types[defect_idx]
        bboxes = []

        if defect_type == 'scratch':
            bboxes = self._add_scratch(draw)
        elif defect_type == 'particle':
            bboxes = self._add_particle(draw)
        elif defect_type == 'contamination':
            bboxes = self._add_contamination(draw)
        elif defect_type == 'crack':
            bboxes = self._add_crack(draw)

        img_array = np.array(img, dtype=np.float32) / 255.0
        img_tensor = torch.from_numpy(img_array).unsqueeze(0)

        return img_tensor, defect_idx, bboxes


class DefectDetector:
    def __init__(self, model_path=None):
        self.model = resnet18().to(DEVICE)
        if model_path and os.path.exists(model_path):
            self.model.load_state_dict(torch.load(model_path, map_location=DEVICE))
        self.model.eval()
        self.transform = transforms.Compose([
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
        ])

    def preprocess_image(self, image):
        if isinstance(image, str):
            image = Image.open(image).convert('L')
        elif isinstance(image, np.ndarray):
            if len(image.shape) == 3:
                image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            image = Image.fromarray(image)
        
        image = self.transform(image)
        return image.unsqueeze(0).to(DEVICE)

    def detect(self, image):
        img_tensor = self.preprocess_image(image)
        
        with torch.no_grad():
            outputs, features = self.model(img_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probabilities, 1)

        defect_type = DEFECT_TYPES[predicted.item()]
        confidence_score = confidence.item()

        heatmap = self._generate_heatmap(img_tensor)

        return {
            'defect_type': defect_type,
            'confidence': confidence_score,
            'heatmap': heatmap,
            'probabilities': probabilities.cpu().numpy()[0].tolist()
        }

    def _generate_heatmap(self, img_tensor):
        self.model.eval()
        
        x = self.model.conv1(img_tensor)
        x = self.model.bn1(x)
        x = self.model.relu(x)
        x = self.model.maxpool(x)
        
        x = self.model.layer1(x)
        x = self.model.layer2(x)
        x = self.model.layer3(x)
        feature_map = self.model.layer4(x)
        
        weights = torch.mean(feature_map, dim=(2, 3), keepdim=True)
        cam = torch.sum(weights * feature_map, dim=1, keepdim=True)
        cam = torch.relu(cam)
        
        cam = cam.cpu().numpy()[0, 0]
        cam = cv2.resize(cam, (IMAGE_SIZE, IMAGE_SIZE))
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        
        return cam


def train_classifier(num_epochs=20, batch_size=32):
    model = resnet18().to(DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    dataset = WaferDataset(num_samples=5000)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    for epoch in range(num_epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for i, (images, labels, _) in enumerate(dataloader):
            images, labels = images.to(DEVICE), labels.to(DEVICE)

            optimizer.zero_grad()
            outputs, _ = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()

            if i % 50 == 0:
                print(f"[Epoch {epoch}/{num_epochs}] [Batch {i}/{len(dataloader)}] Loss: {loss.item():.4f} Acc: {100*correct/total:.2f}%")

        epoch_acc = 100 * correct / total
        print(f"Epoch {epoch} - Accuracy: {epoch_acc:.2f}%")

    return model


if __name__ == "__main__":
    print("Training ResNet classifier...")
    model = train_classifier(num_epochs=10)
    torch.save(model.state_dict(), "classifier.pth")
    print("Classifier training completed.")
