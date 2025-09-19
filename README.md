# Flag Football Play Designer

A modern, touch-friendly, interactive playbook builder for flag football coaches. Built with Next.js and React for optimal performance and responsiveness.

## Features

- 🏈 **Interactive Field**: Drag and drop players on a realistic football field
- 📱 **Touch-Friendly**: Optimized for mobile devices and tablets
- 🎨 **Route Drawing**: Draw player routes with automatic smoothing and straightening
- 📐 **Snap-to-Grid**: Precise positioning with 30x30 grid system
- 🏃 **Formation Presets**: Pre-built formations (Gun Empty Bunch Right/Left, Gun Empty Ace)
- ✏️ **Drawing Tools**: Draw, erase, undo, and clear functionality
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **CSS3** - Responsive styling with touch optimizations
- **HTML5 Canvas** - High-performance drawing and rendering

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd flag-football-play-designer
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Usage

### Player Management
- **Center (C)**: Fixed position, non-draggable
- **Quarterback (QB)**: Draggable, stays horizontally centered
- **Wide Receivers (WR1-WR4)**: Fully draggable with snap-to-grid

### Drawing Tools
- **Draw**: Click and drag to draw routes
- **Eraser**: Click and drag to erase drawn routes
- **Undo**: Remove the last drawn route
- **Clear**: Remove all drawn routes

### Formations
- **Gun Empty Bunch Right**: Right-side bunch formation
- **Gun Empty Bunch Left**: Left-side bunch formation  
- **Gun Empty Ace**: Spread formation
- **Custom**: Manual player positioning

## Mobile Optimization

The app is specifically optimized for touch devices:
- Larger touch targets (44px minimum)
- Touch-friendly drag and drop
- Responsive canvas sizing
- Optimized for portrait and landscape orientations

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on multiple devices
5. Submit a pull request

## License

MIT License - see LICENSE file for details
