import { Router, Request, Response } from 'express';
import { MATCH_PRESETS, DEFAULT_RULES, applyPreset } from '../utils/matchRules';

const router = Router();

router.get('/presets', (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: MATCH_PRESETS,
    });
  } catch (error: any) {
    console.error('Get presets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch presets',
    });
  }
});

router.get('/presets/:name', (req: Request, res: Response) => {
  try {
    const presetName = req.params.name;
    const preset = MATCH_PRESETS.find((p) => p.name === presetName);

    if (!preset) {
      res.status(404).json({
        success: false,
        message: 'Preset not found',
      });
      return;
    }

    const rules = applyPreset(presetName);

    res.status(200).json({
      success: true,
      data: {
        ...preset,
        rules,
      },
    });
  } catch (error: any) {
    console.error('Get preset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preset',
    });
  }
});

export default router;
