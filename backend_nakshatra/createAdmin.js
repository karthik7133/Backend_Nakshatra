// createAdmin.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('./models/Admin'); // Adjust path if necessary

// Load environment variables (needed for MONGO_URI)
dotenv.config(); 

const MONGO_URI ='mongodb+srv://karthik7133:Ch.karthik.7@cluster7133.yzxk6k4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster7133';
// Ensure your MONGO_URI environment variable is correctly set in Render!

const createSuperAdmin = async () => {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log(`\n✅ MongoDB Connected to: ${mongoose.connection.name}`);

    try {
        // 2. Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: 'adminkarthik@gmail.com' });

        if (existingAdmin) {
            console.warn(`⚠️ Admin with email adminkarthik@gmail.com already exists! Skipping creation.`);
            return;
        }

        // 3. Create a new Admin document
        const newAdmin = new Admin({
            name: 'adminkarthik',
            email: 'adminkarthik@gmail.com',
            // IMPORTANT: The password is set directly here. 
            // The Admin model's pre('save') hook will hash it into passwordHash.
            passwordHash: 'ch.karthik.7', 
            role: 'super_admin', // Gives maximum access
            permissions: [
                'view_users',
                'manage_users',
                'view_reports',
                'manage_reports',
                'send_notifications',
                'moderate_content',
                'system_settings'
            ]
        });

        // 4. Save the document (triggers hashing)
        await newAdmin.save();
        console.log(`\n🎉 Success! Super Admin created:`);
        console.log(`Name: ${newAdmin.name}`);
        console.log(`Email: ${newAdmin.email}`);
        console.log(`Role: ${newAdmin.role}`);
        console.log(`ID: ${newAdmin._id}`);

    } catch (error) {
        console.error('❌ Error creating Admin:', error.message);
    } finally {
        // 5. Disconnect
        await mongoose.disconnect();
        console.log(`\n⚡ MongoDB Disconnected.\n`);
    }
};

// Run the script
createSuperAdmin();