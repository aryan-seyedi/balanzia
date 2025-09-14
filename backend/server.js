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
// IMPORTANT: These will come from your Environment Variables on your hosting service
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- File Upload Setup ---
const upload = multer({ storage: multer.memoryStorage() });


// --- API Endpoints ---

// This is the endpoint your frontend will call when a file is imported.
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        const fileContent = req.file.buffer.toString('utf8');
        
        // Using papaparse to read the CSV content from the uploaded file
        const parsed = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
        });

        console.log('Parsed CSV Data:', parsed.data);

        // --- TODO: Normalization Logic ---
        // Here you would use the selected mapping template to transform
        // the parsed data into the format for your database table.
        // For now, we'll just log it.

        // --- TODO: Deduplication and Database Insert ---
        // For each normalized row, create a unique hash, check if it exists,
        // and if not, insert it into the 'transactions' table in Supabase.

        res.status(200).json({ 
            message: 'File processed successfully!',
            data: parsed.data // Sending back the parsed data for now
        });

    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).send('Error processing file.');
    }
});

// --- TODO: Add other endpoints ---
// GET /api/transactions
// POST /api/cost-centers
// etc.


// --- Start Server ---
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
