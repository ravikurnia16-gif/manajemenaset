const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- VENDOR CRUD ---

exports.getAllVendors = async (req, res) => {
    try {
        const { search, category } = req.query;
        let where = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { description: { contains: search } }
            ];
        }

        if (category) {
            where.category = category;
        }

        const vendors = await prisma.vendor.findMany({
            where,
            include: {
                _count: {
                    select: { products: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getVendorById = async (req, res) => {
    try {
        const { id } = req.params;
        const vendor = await prisma.vendor.findUnique({
            where: { id: parseInt(id) },
            include: {
                products: true
            }
        });
        if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createVendor = async (req, res) => {
    try {
        const { name, address, phone, email, website, description, category, photo, isVerified } = req.body;
        const vendor = await prisma.vendor.create({
            data: { name, address, phone, email, website, description, category, photo, isVerified: isVerified || false }
        });
        res.json(vendor);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Nama vendor sudah ada.' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, phone, email, website, description, category, photo, isVerified } = req.body;
        const vendor = await prisma.vendor.update({
            where: { id: parseInt(id) },
            data: { name, address, phone, email, website, description, category, photo, isVerified: isVerified || false }
        });
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.vendor.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Vendor deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- PRODUCT CRUD ---

exports.getVendorProducts = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const products = await prisma.vendorProduct.findMany({
            where: { vendorId: parseInt(vendorId) },
            orderBy: { name: 'asc' }
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addProduct = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { name, price, specification, image } = req.body;
        const product = await prisma.vendorProduct.create({
            data: {
                vendorId: parseInt(vendorId),
                name,
                price: price !== "" && price !== null && price !== undefined ? parseFloat(price) : null,
                specification,
                image
            }
        });
        res.json(product);
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const data = { ...req.body };

        // Sanitize price
        if (data.hasOwnProperty('price')) {
            data.price = data.price !== "" && data.price !== null && data.price !== undefined ? parseFloat(data.price) : null;
        }

        const product = await prisma.vendorProduct.update({
            where: { id: parseInt(productId) },
            data
        });
        res.json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        await prisma.vendorProduct.delete({ where: { id: parseInt(productId) } });
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

