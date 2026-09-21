import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { masterPool } from '../config/tenantDb.js';
import { logActivity } from '../utils/activityLogger.js';

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantFolder = req.tenantDbName || (req.tenantId ? `tenant_${req.tenantId}` : 'common');
    const targetDir = path.join('uploads', 'tenants', tenantFolder, 'logos');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${uniqueSuffix}${ext}`);
  }
});

const logoFileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|jfif|pjpeg|pjp|png|webp|avif|gif|svg|bmp|tiff|tif|heic|heif/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isMimeImage = file.mimetype && file.mimetype.startsWith('image/');
  const isExtImage = allowedExts.test(ext);

  if (isMimeImage || isExtImage) {
    return cb(null, true);
  }
  cb(new Error('Invalid image file format. Allowed formats: PNG, JPG, JPEG, JFIF, WEBP, SVG, AVIF.'));
};

export const logoUploadMulter = multer({
  storage: logoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: logoFileFilter
});

// @desc    Get all settings keys for tenant
// @route   GET /api/settings
// @access  Private
export const getSettings = async (req, res, next) => {
  try {
    const [settings] = await req.db.query('SELECT `key`, `value` FROM settings');
    
    // Format to a key-value object
    const settingsObj = {};
    for (const s of settings) {
      settingsObj[s.key] = s.value;
    }

    // Sanitization & Dynamic resolution of dummy/placeholder settings
    const isDummyAddress = (addr) => {
      if (!addr) return true;
      const s = String(addr).toLowerCase().trim();
      return s === '' || s.includes('enter store address') || s.includes('malviya nagar') || s.includes('main commercial market') || s.includes('main market, city center');
    };

    const isDummyPhone = (p) => {
      if (!p) return true;
      const s = String(p).replace(/\D/g, '');
      return s === '' || s === '0000000000' || s === '00000000' || s.startsWith('000000') || s === '9876543210' || s === '9812345678';
    };

    const isDummyGstin = (g) => {
      if (!g) return true;
      const s = String(g).trim().toUpperCase();
      return s === '' || s === '07AAAAA1111A1Z1' || s === '07BBBCC2222B2Z2' || s === '000000000000000' || s.startsWith('000000');
    };

    let tenantMeta = null;
    if (req.tenantId) {
      try {
        const [tRows] = await masterPool.query('SELECT store_name, address, phone, gstin, logo_url FROM tenants WHERE id = ?', [req.tenantId]);
        if (tRows.length > 0) tenantMeta = tRows[0];
      } catch (e) {}
    }

    // 1. Resolve store_name
    if (!settingsObj.store_name || settingsObj.store_name === 'KIRANA MART ERP' || settingsObj.store_name === 'Kirana Mart Enterprise') {
      if (tenantMeta?.store_name) settingsObj.store_name = tenantMeta.store_name;
    }

    // 2. Resolve store_address
    if (isDummyAddress(settingsObj.store_address)) {
      settingsObj.store_address = (!isDummyAddress(tenantMeta?.address)) ? tenantMeta.address : '';
      if (settingsObj.store_address) {
        try {
          await req.db.query('INSERT INTO settings (`key`, `value`) VALUES ("store_address", ?) ON DUPLICATE KEY UPDATE `value` = ?', [settingsObj.store_address, settingsObj.store_address]);
        } catch (e) {}
      }
    }

    // 3. Resolve store_phone
    if (isDummyPhone(settingsObj.store_phone)) {
      let resolvedPhone = (!isDummyPhone(tenantMeta?.phone)) ? tenantMeta.phone : null;
      if (!resolvedPhone) {
        try {
          const [uRows] = await req.db.query(`SELECT contact FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Admin' AND contact IS NOT NULL AND contact != '' LIMIT 1`);
          if (uRows.length > 0 && !isDummyPhone(uRows[0].contact)) resolvedPhone = uRows[0].contact;
        } catch (e) {}
      }
      if (!resolvedPhone && req.user && !isDummyPhone(req.user.contact || req.user.phone)) {
        resolvedPhone = req.user.contact || req.user.phone;
      }
      settingsObj.store_phone = resolvedPhone || '';
      if (resolvedPhone) {
        try {
          await req.db.query('INSERT INTO settings (`key`, `value`) VALUES ("store_phone", ?) ON DUPLICATE KEY UPDATE `value` = ?', [resolvedPhone, resolvedPhone]);
        } catch (e) {}
      }
    }

    // 4. Resolve gstin
    if (isDummyGstin(settingsObj.gstin)) {
      settingsObj.gstin = (!isDummyGstin(tenantMeta?.gstin)) ? tenantMeta.gstin : '';
      try {
        await req.db.query('INSERT INTO settings (`key`, `value`) VALUES ("gstin", ?) ON DUPLICATE KEY UPDATE `value` = ?', [settingsObj.gstin, settingsObj.gstin]);
      } catch (e) {}
    }

    // 5. Resolve store_logo & sanitize missing files on disk
    let resolvedLogo = settingsObj.store_logo || settingsObj.logo_url || tenantMeta?.logo_url || null;
    if (resolvedLogo) {
      const cleanLogoPath = resolvedLogo.startsWith('/') ? resolvedLogo.slice(1) : resolvedLogo;
      const fullLogoDiskPath = path.join(process.cwd(), cleanLogoPath);
      if (!fs.existsSync(fullLogoDiskPath)) {
        const dbDirName = req.tenantDbName || tenantMeta?.database_name || (req.tenantId ? `shop_${req.tenantId}` : null);
        let fallbackDiskLogo = null;
        if (dbDirName) {
          const tenantLogosDir = path.join(process.cwd(), 'uploads', 'tenants', dbDirName, 'logos');
          if (fs.existsSync(tenantLogosDir)) {
            const files = fs.readdirSync(tenantLogosDir).filter(f => !f.startsWith('.'));
            if (files.length > 0) {
              files.sort((a, b) => fs.statSync(path.join(tenantLogosDir, b)).mtimeMs - fs.statSync(path.join(tenantLogosDir, a)).mtimeMs);
              fallbackDiskLogo = `/uploads/tenants/${dbDirName}/logos/${files[0]}`;
            }
          }
        }
        resolvedLogo = fallbackDiskLogo;
        try {
          await req.db.query('UPDATE settings SET `value` = ? WHERE `key` IN ("store_logo", "logo_url")', [resolvedLogo]);
          if (req.tenantId) {
            await masterPool.query('UPDATE tenants SET logo_url = ? WHERE id = ?', [resolvedLogo, req.tenantId]);
          }
        } catch (e) {}
      }
    }
    settingsObj.store_logo = resolvedLogo || '';
    settingsObj.logo_url = resolvedLogo || '';

    return res.status(200).json({ success: true, settings: settingsObj });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload shop logo image
// @route   POST /api/settings/upload-logo
// @access  Private (Admin only)
export const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select an image file to upload.' });
    }

    const logoUrl = `/${req.file.path.replace(/\\/g, '/')}`;

    // Update settings table in active tenant DB
    await req.db.query(
      'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
      ['store_logo', logoUrl, logoUrl]
    );
    await req.db.query(
      'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
      ['logo_url', logoUrl, logoUrl]
    );

    // Update master database tenant record if available
    let tenantIdToSync = req.tenantId;
    if (!tenantIdToSync && req.tenantDbName) {
      try {
        const [tRow] = await masterPool.query('SELECT id FROM tenants WHERE database_name = ?', [req.tenantDbName]);
        if (tRow.length > 0) tenantIdToSync = tRow[0].id;
      } catch (e) {}
    }

    if (tenantIdToSync) {
      try {
        await masterPool.query('UPDATE tenants SET logo_url = ? WHERE id = ?', [logoUrl, tenantIdToSync]);
      } catch (e) {
        console.warn('Failed to update tenant logo_url in master database:', e);
      }
    }

    await logActivity(req.user.id, 'Upload Shop Logo', 'Settings', `Uploaded new store logo: ${logoUrl}`, req.ip);

    return res.status(200).json({
      success: true,
      message: 'Shop logo uploaded successfully',
      logo_url: logoUrl
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update settings bulk for tenant
// @route   PUT /api/settings
// @access  Private
export const updateSettings = async (req, res, next) => {
  const connection = await req.db.getConnection();
  try {
    await connection.beginTransaction();

    const settingsData = req.body; // Key-value object

    if (settingsData.store_phone || settingsData.phone) {
      const phoneVal = settingsData.store_phone || settingsData.phone;
      const cleaned = String(phoneVal).replace(/\D/g, '');
      if (cleaned.length !== 10) {
        connection.release();
        return res.status(400).json({ success: false, message: 'Store Phone / Contact number must be exactly 10 digits' });
      }
      if (settingsData.store_phone) settingsData.store_phone = cleaned;
      if (settingsData.phone) settingsData.phone = cleaned;
    }

    for (const [key, value] of Object.entries(settingsData)) {
      await connection.query(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        [key, String(value), String(value)]
      );
    }

    // Also sync logo_url or store_name to master tenants table if provided
    let tenantIdToSyncMaster = req.tenantId;
    if (!tenantIdToSyncMaster && req.tenantDbName) {
      try {
        const [tRow] = await masterPool.query('SELECT id FROM tenants WHERE database_name = ?', [req.tenantDbName]);
        if (tRow.length > 0) tenantIdToSyncMaster = tRow[0].id;
      } catch (e) {}
    }

    if (tenantIdToSyncMaster && (settingsData.store_name !== undefined || settingsData.logo_url !== undefined || settingsData.store_logo !== undefined)) {
      try {
        const logo = settingsData.logo_url !== undefined ? settingsData.logo_url : settingsData.store_logo;
        if (settingsData.store_name && logo !== undefined) {
          await masterPool.query('UPDATE tenants SET store_name = ?, logo_url = ? WHERE id = ?', [settingsData.store_name, logo || null, tenantIdToSyncMaster]);
        } else if (settingsData.store_name) {
          await masterPool.query('UPDATE tenants SET store_name = ? WHERE id = ?', [settingsData.store_name, tenantIdToSyncMaster]);
        } else if (logo !== undefined) {
          await masterPool.query('UPDATE tenants SET logo_url = ? WHERE id = ?', [logo || null, tenantIdToSyncMaster]);
        }
      } catch (e) {
        console.warn('Failed to update master tenant record:', e);
      }
    }

    await connection.commit();

    await logActivity(req.user.id, 'Update Settings', 'Settings', 'Updated application configuration settings.', req.ip);

    return res.status(200).json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// @desc    Get all warehouses for tenant
// @route   GET /api/settings/warehouses
// @access  Private
export const getWarehouses = async (req, res, next) => {
  try {
    const [warehouses] = await req.db.query('SELECT * FROM warehouses ORDER BY name ASC');
    return res.status(200).json({ success: true, count: warehouses.length, warehouses });
  } catch (error) {
    next(error);
  }
};
