export interface SpineTheme {
    bg: string;
    text: string;
    accent: string;
    vol: string;
    subtitle: string;
    borderColor: string;
    colIndex: number;
    rawImg: string;
    colors: string[]; // Gradients colors for canvas drawing
}

export const spineThemes: Record<string, SpineTheme> = {
    "dragon_ball": {
        bg: "linear-gradient(to bottom, #42a5f5 0%, #1565c0 50%, #0d47a1 100%)",
        text: "#ffffff",
        accent: "#ffd54f",
        vol: "1",
        subtitle: "DB ORIGINAL",
        borderColor: "#0d47a1",
        colIndex: 0,
        rawImg: "/icons/series-icons/goku-raw-db.png",
        colors: ["#42a5f5", "#1565c0", "#0d47a1"]
    },
    "dragon_ball_z": {
        bg: "linear-gradient(to bottom, #ff7043 0%, #d84315 50%, #b71c1c 100%)",
        text: "#ffffff",
        accent: "#ffd54f",
        vol: "2",
        subtitle: "DRAGON BALL Z",
        borderColor: "#b71c1c",
        colIndex: 1,
        rawImg: "/icons/series-icons/goku-raw-dbz.png",
        colors: ["#ff7043", "#d84315", "#b71c1c"]
    },
    "dragon_ball_gt": {
        bg: "linear-gradient(to bottom, #7e57c2 0%, #4a148c 50%, #1a237e 100%)",
        text: "#ffffff",
        accent: "#ffb74d",
        vol: "3",
        subtitle: "SAGA GT",
        borderColor: "#1a237e",
        colIndex: 2,
        rawImg: "/icons/series-icons/goku-raw-dbgt.png",
        colors: ["#7e57c2", "#4a148c", "#1a237e"]
    },
    "dragon_ball_super": {
        bg: "linear-gradient(to bottom, #26c6da 0%, #00838f 50%, #004d40 100%)",
        text: "#ffffff",
        accent: "#ffd54f",
        vol: "4",
        subtitle: "SUPER",
        borderColor: "#004d40",
        colIndex: 3,
        rawImg: "/icons/series-icons/goku-raw-dbs.png",
        colors: ["#26c6da", "#00838f", "#004d40"]
    },
    "dragon_ball_daima": {
        bg: "linear-gradient(to bottom, #ffca28 0%, #f57f17 50%, #e65100 100%)",
        text: "#ffffff",
        accent: "#ffffff",
        vol: "5",
        subtitle: "DAIMA",
        borderColor: "#e65100",
        colIndex: 4,
        rawImg: "/icons/series-icons/goku-raw-daima.png",
        colors: ["#ffca28", "#f57f17", "#e65100"]
    }
};

export const getSpineConfig = (seriesId: string, id: number): SpineTheme => {
    const theme = spineThemes[seriesId];
    if (theme) return theme;
    
    // Fallback theme
    const colors = [
        { bg: "linear-gradient(to bottom, #ff7043, #d84315, #bf360c)", colors: ["#ff7043", "#d84315", "#bf360c"], borderColor: "#bf360c" },
        { bg: "linear-gradient(to bottom, #ab47bc, #7b1fa2, #4a148c)", colors: ["#ab47bc", "#7b1fa2", "#4a148c"], borderColor: "#4a148c" },
        { bg: "linear-gradient(to bottom, #66bb6a, #388e3c, #1b5e20)", colors: ["#66bb6a", "#388e3c", "#1b5e20"], borderColor: "#1b5e20" },
        { bg: "linear-gradient(to bottom, #42a5f5, #1976d2, #0d47a1)", colors: ["#42a5f5", "#1976d2", "#0d47a1"], borderColor: "#0d47a1" }
    ];
    const cfg = colors[id % colors.length];
    return {
        bg: cfg.bg,
        text: "#ffffff",
        accent: "#ff6e3a",
        vol: String((id % 5) + 1),
        subtitle: "SERIE",
        borderColor: cfg.borderColor,
        colIndex: id % 5,
        rawImg: "/icons/series-icons/goku-raw-dbz.png",
        colors: cfg.colors
    };
};

// Intelligently remove black background using flood-fill (magic wand) from image edges.
// This preserves all internal black details like eyes, hair, and clothing lines.
const removeBlackBackground = (img: HTMLImageElement): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    const height = canvas.height;

    // BFS queue for pixel coordinates
    const queue: number[] = [];
    const visited = new Uint8Array(width * height);

    // Initialize borders in queue
    for (let x = 0; x < width; x++) {
        // Top edge
        queue.push(x, 0);
        visited[x] = 1;
        // Bottom edge
        queue.push(x, height - 1);
        visited[x + (height - 1) * width] = 1;
    }
    for (let y = 1; y < height - 1; y++) {
        // Left edge
        queue.push(0, y);
        visited[y * width] = 1;
        // Right edge
        queue.push(width - 1, y);
        visited[(width - 1) + y * width] = 1;
    }

    // A pixel is considered black background if all RGB values are below threshold
    const isBlackBg = (r: number, g: number, b: number) => {
        return r < 40 && g < 40 && b < 40;
    };

    let head = 0;
    while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        const idx = (cx + cy * width) * 4;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (isBlackBg(r, g, b)) {
            data[idx + 3] = 0; // Turn alpha to transparent

            // Check 4-way neighbors
            const neighbors = [
                [cx - 1, cy],
                [cx + 1, cy],
                [cx, cy - 1],
                [cx, cy + 1]
            ];

            for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nidx = nx + ny * width;
                    if (!visited[nidx]) {
                        visited[nidx] = 1;
                        queue.push(nx, ny);
                    }
                }
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
};

// Generates the final stitched panorama image
export const generateGokuPanorama = (): Promise<string> => {
    return new Promise((resolve) => {
        const colWidth = 270; // High quality column width
        const colHeight = 600;
        const totalColumns = 5;
        
        const canvas = document.createElement("canvas");
        canvas.width = colWidth * totalColumns;
        canvas.height = colHeight;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            resolve("");
            return;
        }

        const keys = ["dragon_ball", "dragon_ball_z", "dragon_ball_gt", "dragon_ball_super", "dragon_ball_daima"];
        let loadedCount = 0;
        const images: Record<string, HTMLImageElement> = {};

        const onImageLoad = () => {
            loadedCount++;
            if (loadedCount === keys.length) {
                // Draw each column
                keys.forEach((key, index) => {
                    const theme = spineThemes[key];
                    const img = images[key];
                    const xOffset = index * colWidth;

                    // 1. Draw vertical gradient background
                    const grad = ctx.createLinearGradient(xOffset, 0, xOffset, colHeight);
                    grad.addColorStop(0, theme.colors[0]);
                    grad.addColorStop(0.5, theme.colors[1]);
                    grad.addColorStop(1, theme.colors[2]);
                    ctx.fillStyle = grad;
                    ctx.fillRect(xOffset, 0, colWidth, colHeight);

                    // If image failed to load, skip drawing characters on this column
                    if (!img || img.naturalWidth === 0) {
                        return;
                    }

                    // Process image to remove black background using flood fill
                    const transparentCanvas = removeBlackBackground(img);

                    // 2. Draw faded background Goku (silhouette)
                    ctx.save();
                    ctx.globalAlpha = 0.18;
                    // Apply crop & scale
                    const bgScale = 1.6;
                    const bgW = colWidth * bgScale;
                    const bgH = (colHeight * 0.7) * bgScale;
                    const bgX = xOffset + (colWidth - bgW) / 2;
                    const bgY = 50; // top positioning
                    
                    ctx.drawImage(transparentCanvas, bgX, bgY, bgW, bgH);
                    ctx.restore();

                    // 3. Draw sharp standing Goku at the bottom
                    const fgScale = 0.95;
                    const fgW = colWidth * fgScale;
                    // Keep aspect ratio
                    const aspectRatio = img.naturalHeight / img.naturalWidth;
                    const fgH = fgW * aspectRatio;
                    const fgX = xOffset + (colWidth - fgW) / 2;
                    const fgY = colHeight - fgH - 10; // offset slightly from bottom

                    ctx.drawImage(transparentCanvas, fgX, fgY, fgW, fgH);
                });

                resolve(canvas.toDataURL("image/png"));
            }
        };

        keys.forEach((key) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = spineThemes[key].rawImg;
            img.onload = onImageLoad;
            img.onerror = () => {
                console.error("Failed to load Goku asset:", spineThemes[key].rawImg);
                loadedCount++;
                if (loadedCount === keys.length) {
                    onImageLoad();
                }
            };
            images[key] = img;
        });
    });
};
