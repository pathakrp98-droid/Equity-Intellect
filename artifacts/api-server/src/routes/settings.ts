import { Router } from "express";

const router = Router();

router.post("/import/zerodha", (req, res) => {
  const { csvContent } = req.body;
  if (!csvContent) {
    res.status(400).json({ success: false, imported: 0, skipped: 0, errors: ["csvContent is required"], message: "No CSV content provided" });
    return;
  }
  // Simulate parsing
  const lines = csvContent.split("\n").filter((l: string) => l.trim().length > 0);
  const dataLines = lines.slice(1); // skip header
  res.json({
    success: true,
    imported: Math.max(0, dataLines.length - 1),
    skipped: 1,
    errors: [],
    message: `Successfully imported ${Math.max(0, dataLines.length - 1)} holdings from Zerodha. Demo mode — data not persisted.`,
  });
});

router.post("/import/hdfc", (req, res) => {
  const { csvContent } = req.body;
  if (!csvContent) {
    res.status(400).json({ success: false, imported: 0, skipped: 0, errors: ["csvContent is required"], message: "No CSV content provided" });
    return;
  }
  const lines = csvContent.split("\n").filter((l: string) => l.trim().length > 0);
  const dataLines = lines.slice(1);
  res.json({
    success: true,
    imported: Math.max(0, dataLines.length - 1),
    skipped: 1,
    errors: [],
    message: `Successfully imported ${Math.max(0, dataLines.length - 1)} holdings from HDFC InvestRight. Demo mode — data not persisted.`,
  });
});

export default router;
