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

  async canGenerate(userId) {
    const [limit, currentUsage] = await Promise.all([
      this.getPlanLimit(userId),
      this.getCurrentMonthUsage(userId),
    ]);

    return currentUsage < limit;
  }
  async updateUsageCounter(userId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JavaScript months are 0-based
    const timestamp = now.toISOString();

    try {
      await this.db.run(
        `
        INSERT INTO usage_counter (user_id, year, month, count, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, year, month) DO UPDATE SET
          count = count + 1,
          updated_at = ?
      `,
        [userId, year, month, timestamp, timestamp, timestamp]
      );
    } catch (error) {
      console.error('Error updating usage counter:', error);
      throw error;
    }
  }

  async getCurrentMonthUsage(userId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    try {
      const result = await this.db.get(
        `
        SELECT count
        FROM usage_counter
        WHERE user_id = ? 
        AND year = ?
        AND month = ?
      `,
        [userId, year, month]
      );

      return result?.count || 0;
    } catch (error) {
      console.error('Error getting current month usage:', error);
      return 0;
    }
  }

  async recordGeneratedImage(userId, filePath, requestData = {}) {
    const canGenerate = await this.canGenerate(userId);
    if (!canGenerate) {
      throw new Error('Monthly image generation limit reached');
    }

    const imageId = path.basename(filePath, '.png');
    const fileStats = await fs.stat(filePath);
    const now = new Date().toISOString();

    const {
      html,
      css,
      google_fonts,
      viewport_width,
      viewport_height,
      device_scale,
      template_data,
      template_id, // Falls das Bild von einem Template generiert wurde
    } = requestData;

    await this.db.run('BEGIN TRANSACTION');

    try {
      // Speichere das Bild mit erweiterten Informationen
      await this.db.run(
        `
        INSERT INTO generated_images (
          id, user_id, file_path, original_filename, 
          created_at, file_size, template_id,
          html, css, google_fonts, 
          viewport_width, viewport_height, device_scale,
          template_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          imageId,
          userId,
          filePath,
          path.basename(filePath),
          now,
          fileStats.size,
          template_id || null,
          html || null,
          css || null,
          google_fonts || null,
          viewport_width || null,
          viewport_height || null,
          device_scale || null,
          template_data ? JSON.stringify(template_data) : null,
        ]
      );

      await this.updateUsageCounter(userId);
      await this.db.run('COMMIT');
      return imageId;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async getUserImages(userId, limit = 100, offset = 0) {
    return await this.db.all(
      `
    SELECT 
      gi.id,
      gi.user_id,
      gi.file_path,
      gi.original_filename,
      gi.created_at,
      gi.file_size,
      COALESCE(gi.html, t.html) as html,
      COALESCE(gi.css, t.css) as css,
      COALESCE(gi.google_fonts, t.google_fonts) as google_fonts,
      COALESCE(gi.viewport_width, t.viewport_width) as viewport_width,
      COALESCE(gi.viewport_height, t.viewport_height) as viewport_height,
      COALESCE(gi.device_scale, t.device_scale) as device_scale,
      COALESCE(gi.template_data, t.template_data) as template_data,
      gi.template_id
    FROM generated_images gi
    LEFT JOIN templates t ON gi.template_id = t.id
    WHERE gi.user_id = ? 
    ORDER BY gi.created_at DESC
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

  async deleteImage(imageId, userId) {
    try {
      // Hole die Bildinformationen
      const image = await this.db.get(
        'SELECT * FROM generated_images WHERE id = ? AND user_id = ?',
        [imageId, userId]
      );

      if (!image) {
        throw new Error('Image not found or unauthorized');
      }

      // Lösche nur den Datenbank-Eintrag aus generated_images
      await this.db.run('DELETE FROM generated_images WHERE id = ? AND user_id = ?', [
        imageId,
        userId,
      ]);

      // Lösche die physische Datei
      try {
        if (image.file_path) {
          await fs.unlink(image.file_path);
        }
      } catch (fsError) {
        console.warn(`Could not delete file ${image.file_path}:`, fsError);
      }

      return true;
    } catch (error) {
      console.error('Error in deleteImage:', error);
      throw error;
    }
  }

  async bulkDeleteImages(imageIds, userId) {
    const results = await Promise.allSettled(imageIds.map(id => this.deleteImage(id, userId)));

    return {
      succeeded: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      total: imageIds.length,
    };
  }
}

module.exports = ImageService;
