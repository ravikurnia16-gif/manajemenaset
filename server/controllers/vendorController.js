const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../services/minioService');

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
        const { name, address, phone, email, website, description, category, isVerified } = req.body;
        const vendor = await prisma.vendor.create({
            data: { 
                name, address, phone, email, website, description, category, 
                photo: req.fileUrl || null, 
                isVerified: isVerified === 'true' || isVerified === true 
            }
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
        const { name, address, phone, email, website, description, category, isVerified } = req.body;
        
        const oldVendor = await prisma.vendor.findUnique({ where: { id: parseInt(id) } });

        const vendor = await prisma.vendor.update({
            where: { id: parseInt(id) },
            data: { 
                name, address, phone, email, website, description, category, 
                photo: req.fileUrl || undefined, 
                isVerified: isVerified === 'true' || isVerified === true 
            }
        });

        // Cleanup old photo if updated
        if (req.fileUrl && oldVendor?.photo) {
            await deleteFile(oldVendor.photo);
        }

        res.json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const vendor = await prisma.vendor.findUnique({ where: { id: parseInt(id) } });
        
        if (vendor?.photo) {
            await deleteFile(vendor.photo);
        }

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

exports.getAllProducts = async (req, res) => {
    try {
        const { search } = req.query;
        let where = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { specification: { contains: search } },
                { vendor: { name: { contains: search } } }
            ];
        }

        const products = await prisma.vendorProduct.findMany({
            where,
            include: {
                vendor: {
                    select: {
                        id: true,
                        name: true,
                        category: true,
                        isVerified: true
                    }
                }

            },
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
        const newPrice = price !== "" && price !== null && price !== undefined ? parseFloat(price) : null;
        const product = await prisma.vendorProduct.create({
            data: {
                vendorId: parseInt(vendorId),
                name,
                price: newPrice,
                specification,
                image: req.fileUrl || null
            }
        });

        // Record initial price if exists
        if (newPrice !== null) {
            await prisma.vendorPriceHistory.create({
                data: {
                    productId: product.id,
                    price: newPrice
                }
            });
        }

        res.json(product);
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const { name, price, specification } = req.body;

        const oldProduct = await prisma.vendorProduct.findUnique({ where: { id: parseInt(productId) } });

        const newPrice = price !== "" && price !== null && price !== undefined ? parseFloat(price) : null;

        const product = await prisma.vendorProduct.update({
            where: { id: parseInt(productId) },
            data: {
                name,
                price: newPrice,
                specification,
                image: req.fileUrl || undefined
            }
        });

        // Record price history if price has changed
        if (newPrice !== null && oldProduct.price !== newPrice) {
            await prisma.vendorPriceHistory.create({
                data: {
                    productId: parseInt(productId),
                    price: newPrice
                }
            });
        }

        // Cleanup old image if updated
        if (req.fileUrl && oldProduct?.image) {
            await deleteFile(oldProduct.image);
        }

        res.json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const product = await prisma.vendorProduct.findUnique({ where: { id: parseInt(productId) } });

        if (product?.image) {
            await deleteFile(product.image);
        }

        await prisma.vendorProduct.delete({ where: { id: parseInt(productId) } });
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- PRICE HISTORY ---

exports.getProductPriceHistory = async (req, res) => {
    try {
        const { productId } = req.params;
        const history = await prisma.vendorPriceHistory.findMany({
            where: { productId: parseInt(productId) },
            orderBy: { date: 'desc' }
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

