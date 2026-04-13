const aiService = require("../services/ai.service")


module.exports.getReview = async (req, res) => {
    try {
        const code = req.body.code;

        if (!code || !code.trim()) {
            return res.status(400).json({ error: "Code is required" });
        }

        const response = await aiService(code);

        return res.json({ review: response });
    } catch (error) {
        console.error('AI review failed:', error.message);
        return res.status(500).json({ error: error.message || 'Failed to generate AI review' });
    }

}