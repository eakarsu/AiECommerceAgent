import { sequelize, Product } from '../models/index.js';
import { QueryTypes } from 'sequelize';

class SearchService {
  async ensureSearchIndex() {
    try {
      // Add tsvector column if not exists
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'products' AND column_name = 'search_vector'
          ) THEN
            ALTER TABLE products ADD COLUMN search_vector tsvector;
          END IF;
        END $$;
      `);

      // Create GIN index
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_products_search_vector
        ON products USING GIN(search_vector);
      `);

      // Create trigger function to update search vector
      await sequelize.query(`
        CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector :=
            setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
      `);

      // Create trigger
      await sequelize.query(`
        DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
        CREATE TRIGGER products_search_vector_trigger
        BEFORE INSERT OR UPDATE ON products
        FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
      `);

      // Update existing rows
      await sequelize.query(`
        UPDATE products SET search_vector =
          setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(description, '')), 'C');
      `);

      console.log('Search index initialized');
    } catch (error) {
      console.error('Failed to initialize search index:', error.message);
    }
  }

  async search(query, limit = 20, offset = 0) {
    if (!query || query.trim().length === 0) {
      return { results: [], total: 0 };
    }

    const searchTerm = query.trim();
    const pattern = `%${searchTerm}%`;

    // Use ILIKE for substring matching (works for partial words like "des" -> "designer")
    try {
      const results = await sequelize.query(`
        SELECT * FROM products
        WHERE name ILIKE :pattern OR category ILIKE :pattern OR description ILIKE :pattern
        ORDER BY
          CASE WHEN name ILIKE :pattern THEN 0 ELSE 1 END,
          name
        LIMIT :limit OFFSET :offset
      `, {
        replacements: { pattern, limit, offset },
        type: QueryTypes.SELECT
      });

      const [[{ count }]] = await sequelize.query(`
        SELECT COUNT(*) as count FROM products
        WHERE name ILIKE :pattern OR category ILIKE :pattern OR description ILIKE :pattern
      `, {
        replacements: { pattern }
      });

      return { results: results || [], total: parseInt(count) || 0 };
    } catch (error) {
      console.error('Search failed:', error.message);
      return { results: [], total: 0 };
    }
  }

  async suggest(partialQuery) {
    if (!partialQuery || partialQuery.trim().length < 2) {
      return [];
    }

    const [results] = await sequelize.query(`
      SELECT DISTINCT name, category
      FROM products
      WHERE name ILIKE :pattern OR category ILIKE :pattern
      ORDER BY name
      LIMIT 10
    `, {
      replacements: { pattern: `%${partialQuery.trim()}%` },
      type: QueryTypes.SELECT
    });

    return results;
  }
}

export default new SearchService();
