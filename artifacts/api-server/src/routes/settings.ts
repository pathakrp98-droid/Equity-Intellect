import { Router } from "express";

const router = Router();

router.post("/import/zerodha", (req, res) => {
  const { csvContent } = req.body;
  if (!csvContent) {
    res.status(400).json({ success: false, imported: 0, skipped: 0, errors: ["csvContent is required"], message: "No CSV content provided" });
    return;
  }
  res.status(501).json({
    success: false,
    imported: 0,
    skipped: 0,
    errors: ["Zerodha statement import is not implemented yet — no holdings were saved."],
    message: "Zerodha statement import is not implemented yet. Add holdings manually on the Portfolio page instead.",
  });
});

router.post("/import/hdfc", (req, res) => {
  const { csvContent } = req.body;
  if (!csvContent) {
    res.status(400).json({ success: false, imported: 0, skipped: 0, errors: ["csvContent is required"], message: "No CSV content provided" });
    return;
  }
  res.status(501).json({
    success: false,
    imported: 0,
    skipped: 0,
    errors: ["HDFC InvestRight statement import is not implemented yet — no holdings were saved."],
    message: "HDFC InvestRight statement import is not implemented yet. Add holdings manually on the Portfolio page instead.",
  });
});

export default router;
