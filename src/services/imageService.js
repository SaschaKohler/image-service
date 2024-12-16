const path = require('path');
const { promises: fs } = require('fs');

class ImageService {
  constructor(db) {
    this.db = db;
  }

  async getPlanLimit(userId) {
    const result = await this.db.get(
      `
      SELECT pl.monthly_image_limit
      FROM users u
      JOIN plan_limits pl ON u.plan = pl.plan
      WHERE u.id = ?
    `,
      [userId]
    );

    return result?.monthly_image_limit || 50; // Default to FREE plan limit
  }

  async getCurrentMonthUsage(userId) {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const result = await this.db.get(
      `
      SELECT COUNT(*) as count
      FROM generated_images
      WHERE user_id = ? 
      AND strftime('%Y-%m', created_at) = ?
    `,
      [userId, currentMonth]
    );

    return result?.count || 0;
  }

  async canGenerate(userId) {
    const [limit, currentUsage] = await Promise.all([
      this.getPlanLimit(userId),
      this.getCurrentMonthUsage(userId),
    ]);

    return currentUsage < limit;
  }

  async recordGeneratedImage(userId, filePath) {
    // Überprüfe zuerst ob noch generiert werden darf
    const canGenerate = await this.canGenerate(userId);
    if (!canGenerate) {
      throw new Error('Monthly image generation limit reached');
    }

    const imageId = path.basename(filePath, '.png');
    const fileStats = await fs.stat(filePath);

    await this.db.run(
      `
      INSERT INTO generated_images (
        id,
        user_id,
        file_path,
        original_filename,
        created_at,
        file_size
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
      [imageId, userId, filePath, path.basename(filePath), new Date().toISOString(), fileStats.size]
    );

    return imageId;
  }

  async getUserImages(userId, limit = 100, offset = 0) {
    return await this.db.all(
      `
      SELECT * FROM generated_images 
      WHERE user_id = ? 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
      [userId, limit, offset]
    );
  }

  async getImageStats(userId) {
    const [limit, currentUsage] = await Promise.all([
      this.getPlanLimit(userId),
      this.getCurrentMonthUsage(userId),
    ]);

    const user = await this.db.get('SELECT plan FROM users WHERE id = ?', [userId]);

    return {
      currentUsage,
      limit,
      plan: user?.plan || 'FREE',
      remainingImages: Math.max(0, limit - currentUsage),
      isLimitReached: currentUsage >= limit,
    };
  }
}

module.exports = ImageService;
