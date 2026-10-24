import { logActivity } from '../utils/activityLogger.js';

// @desc    Get all brands
// @route   GET /api/brands
// @access  Private
export const getBrands = async (req, res, next) => {
  try {
    const { status, search, category_id, sub_category_id } = req.query;

    let queryStr = `
      SELECT b.*, 
             c.name as category_name,
             sc.name as sub_category_name
      FROM brands b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN sub_categories sc ON b.sub_category_id = sc.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      queryStr += ' AND b.category_id = ?';
      params.push(Number(category_id));
    }

    if (sub_category_id) {
      queryStr += ' AND b.sub_category_id = ?';
      params.push(Number(sub_category_id));
    }

    if (status) {
      queryStr += ' AND b.status = ?';
      params.push(status);
    }

    if (search) {
      queryStr += ' AND (b.name LIKE ? OR c.name LIKE ? OR sc.name LIKE ? OR b.description LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    queryStr += ' ORDER BY c.name ASC, sc.name ASC, b.name ASC';

    const [brands] = await req.db.query(queryStr, params);

    return res.status(200).json({
      success: true,
      count: brands.length,
      brands
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a brand
// @route   POST /api/brands
// @access  Private
export const createBrand = async (req, res, next) => {
  try {
    const { name, category_id, sub_category_id, description, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Brand Name is required' });
    }

    if (!category_id) {
      return res.status(400).json({ success: false, message: 'Parent Main Category is required' });
    }

    if (!sub_category_id) {
      return res.status(400).json({ success: false, message: 'Parent Sub Category is required' });
    }

    const catIdNum = Number(category_id);
    const subCatIdNum = Number(sub_category_id);

    // Verify Main Category and Subcategory exist
    const [parentCat] = await req.db.query('SELECT id, name FROM categories WHERE id = ?', [catIdNum]);
    if (parentCat.length === 0) {
      return res.status(404).json({ success: false, message: 'Selected Parent Category does not exist' });
    }

    const [parentSub] = await req.db.query('SELECT id, name FROM sub_categories WHERE id = ?', [subCatIdNum]);
    if (parentSub.length === 0) {
      return res.status(404).json({ success: false, message: 'Selected Sub Category does not exist' });
    }

    // Duplicate check under same category and subcategory
    const [existing] = await req.db.query(
      'SELECT id FROM brands WHERE name = ? AND category_id = ? AND sub_category_id = ?',
      [name.trim(), catIdNum, subCatIdNum]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `A Brand named "${name.trim()}" already exists under subcategory "${parentSub[0].name}".`
      });
    }

    const statusVal = status || 'Active';

    const [result] = await req.db.query(
      `INSERT INTO brands (name, category_id, sub_category_id, description, status) VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), catIdNum, subCatIdNum, description ? description.trim() : null, statusVal]
    );

    await logActivity(req.user.id, 'Create Brand', 'Brands',
      `Created Brand "${name.trim()}" under "${parentCat[0].name} > ${parentSub[0].name}" (ID: ${result.insertId})`, req.ip);

    return res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      brand: {
        id: result.insertId,
        name: name.trim(),
        category_id: catIdNum,
        category_name: parentCat[0].name,
        sub_category_id: subCatIdNum,
        sub_category_name: parentSub[0].name,
        description: description ? description.trim() : null,
        status: statusVal
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a brand
// @route   PUT /api/brands/:id
// @access  Private
export const updateBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category_id, sub_category_id, description, status } = req.body;

    const [existing] = await req.db.query('SELECT * FROM brands WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const targetName = name !== undefined ? name.trim() : existing[0].name;
    const targetCatId = category_id !== undefined ? (category_id ? Number(category_id) : null) : existing[0].category_id;
    const targetSubCatId = sub_category_id !== undefined ? (sub_category_id ? Number(sub_category_id) : null) : existing[0].sub_category_id;

    // Verify Category & Subcategory if provided
    if (category_id) {
      const [parentCat] = await req.db.query('SELECT id FROM categories WHERE id = ?', [targetCatId]);
      if (parentCat.length === 0) {
        return res.status(404).json({ success: false, message: 'Selected Parent Category does not exist' });
      }
    }

    if (sub_category_id) {
      const [parentSub] = await req.db.query('SELECT id FROM sub_categories WHERE id = ?', [targetSubCatId]);
      if (parentSub.length === 0) {
        return res.status(404).json({ success: false, message: 'Selected Sub Category does not exist' });
      }
    }

    // Duplicate check excluding self under same category and subcategory
    if (targetName && targetCatId && targetSubCatId) {
      const [dupCheck] = await req.db.query(
        'SELECT id FROM brands WHERE name = ? AND category_id = ? AND sub_category_id = ? AND id != ?',
        [targetName, targetCatId, targetSubCatId, id]
      );
      if (dupCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: `A Brand named "${targetName}" already exists under this Sub Category.`
        });
      }
    }

    await req.db.query(
      `UPDATE brands 
       SET name = ?, category_id = ?, sub_category_id = ?, description = ?, status = ?
       WHERE id = ?`,
      [
        targetName,
        targetCatId,
        targetSubCatId,
        description !== undefined ? (description ? description.trim() : null) : existing[0].description,
        status || existing[0].status,
        id
      ]
    );

    // Sync products table if both category and subcategory are set
    if (targetCatId && targetSubCatId) {
      await req.db.query('UPDATE products SET category_id = ?, sub_category_id = ? WHERE brand_id = ?', [targetCatId, targetSubCatId, id]);
    }

    await logActivity(req.user.id, 'Update Brand', 'Brands',
      `Updated Brand ID: ${id} to "${targetName}"`, req.ip);

    return res.status(200).json({
      success: true,
      message: 'Brand updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle brand status (Active/Inactive)
// @route   PATCH /api/brands/:id/status
// @access  Private
export const toggleBrandStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [existing] = await req.db.query('SELECT id, name, status FROM brands WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const newStatus = status || (existing[0].status === 'Active' ? 'Inactive' : 'Active');

    await req.db.query('UPDATE brands SET status = ? WHERE id = ?', [newStatus, id]);

    await logActivity(req.user.id, 'Toggle Brand Status', 'Brands',
      `Toggled status of Brand "${existing[0].name}" (ID: ${id}) to ${newStatus}`, req.ip);

    return res.status(200).json({
      success: true,
      message: `Brand "${existing[0].name}" is now ${newStatus}`,
      status: newStatus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a brand (Disabled by ERP policy)
// @route   DELETE /api/brands/:id
// @access  Private
export const deleteBrand = async (req, res, next) => {
  return res.status(403).json({
    success: false,
    message: 'Permanent deletion is disabled in Kirana ERP master settings. Please toggle status to Inactive instead.'
  });
};
