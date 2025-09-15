import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Supabase Client ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- File Upload Setup ---
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper Function to Create a Unique ID (e.g., hash of key fields) ---
const createTransactionHash = (transaction) => {
    return btoa(JSON.stringify({
        date: transaction.date,
        merchant: transaction.merchant,
        amount: transaction.amount,
        account: transaction.account
    }));
};

// --- API Endpoints ---

// Login Endpoint
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    // For this example, we'll use a simple hardcoded password.
    // In a real application, you would use a secure authentication method.
    const CORRECT_PASSWORD = process.env.LOGIN_PASSWORD || 'defaultpassword';
    if (password === CORRECT_PASSWORD) {
        return res.status(200).json({ success: true, message: 'Logged in successfully.' });
    }
    res.status(401).json({ success: false, message: 'Incorrect password.' });
});

// GET All Transactions
app.get('/api/transactions', async (req, res) => {
    const { data, error } = await supabase.from('transactions').select('*');
    if (error) {
        console.error('Error fetching transactions:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(200).json(data);
});

// GET All Cost Centers
app.get('/api/cost-centers', async (req, res) => {
    const { data, error } = await supabase.from('cost_centers').select('name');
    if (error) {
        console.error('Error fetching cost centers:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(200).json(data);
});

// GET All Mappings
app.get('/api/mappings', async (req, res) => {
    const { data, error } = await supabase.from('mappings').select('*');
    if (error) {
        console.error('Error fetching mappings:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(200).json(data);
});

// Update a Single Transaction
app.patch('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;
    const { costCenter } = req.body;
    const status = costCenter ? 'Processed' : 'Review Required';
    const { data, error } = await supabase
        .from('transactions')
        .update({ costCenter, status })
        .eq('id', id)
        .select();

    if (error) {
        console.error('Error updating transaction:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(200).json(data[0]);
});

// Add a New Cost Center
app.post('/api/cost-centers', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required.' });
    }
    const { data, error } = await supabase.from('cost_centers').insert({ name }).select();
    if (error) {
        console.error('Error adding cost center:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
});

// Remove a Cost Center
app.delete('/api/cost-centers/:name', async (req, res) => {
    const { name } = req.params;
    const { error } = await supabase.from('cost_centers').delete().eq('name', name);
    if (error) {
        console.error('Error removing cost center:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(204).end();
});

// Add a New Mapping
app.post('/api/mappings', async (req, res) => {
    const { name, fileType = 'CSV' } = req.body;
    const { data, error } = await supabase.from('mappings').insert({ name, fileType, dateCreated: new Date().toISOString() }).select();
    if (error) {
        console.error('Error adding mapping:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
});

// Remove a Mapping
app.delete('/api/mappings/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('mappings').delete().eq('id', id);
    if (error) {
        console.error('Error removing mapping:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(204).end();
});

// File Upload Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        const fileContent = req.file.buffer.toString('utf8');
        const parsed = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true, // Automatically converts numbers
        });

        // Normalize and Deduplicate data
        const normalizedData = parsed.data.map(row => ({
            date: new Date(row.Date).toISOString().split('T')[0], // Ensure a standard date format
            merchant: row.Description || row.Merchant,
            amount: parseFloat(row.Amount || row.Debit),
            account: row.Account || 'Default',
            // Default status for new transactions
            status: 'Review Required',
            hash: createTransactionHash({
                date: row.Date,
                merchant: row.Description || row.Merchant,
                amount: parseFloat(row.Amount || row.Debit),
                account: row.Account || 'Default',
            }),
        })).filter(t => !isNaN(t.amount));

        const { data: existingTransactions } = await supabase
            .from('transactions')
            .select('hash')
            .in('hash', normalizedData.map(t => t.hash));

        const existingHashes = new Set(existingTransactions.map(t => t.hash));
        const newTransactions = normalizedData.filter(t => !existingHashes.has(t.hash));

        if (newTransactions.length > 0) {
            const { error: insertError } = await supabase.from('transactions').insert(newTransactions);
            if (insertError) {
                console.error('Error inserting transactions:', insertError);
                throw new Error('Database insertion failed.');
            }
        }

        res.status(200).json({
            message: `${newTransactions.length} new transactions processed and saved successfully.`,
        });

    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ message: `File upload failed: ${error.message}` });
    }
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});