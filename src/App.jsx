import { useState, useMemo, useEffect } from 'react';

// The base URL for your backend API, read from the environment variable.
// It falls back to localhost for easy local development.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Main App Component
export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    // Data is now initialized as empty, to be filled by live API calls
    const [transactions, setTransactions] = useState([]);
    const [costCenters, setCostCenters] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [isLoading, setIsLoading] = useState(true); // To show a loading message

    const [isManageCostCenterModalOpen, setIsManageCostCenterModalOpen] = useState(false);
    const [isManageMappingsModalOpen, setIsManageMappingsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    const [newCostCenter, setNewCostCenter] = useState('');
    const [newMappingName, setNewMappingName] = useState('');
    
    // Filters State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterMerchant, setFilterMerchant] = useState('');
    const [filterAccount, setFilterAccount] = useState('');
    const [filterCostCenter, setFilterCostCenter] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // --- Helper function to fetch transactions ---
    const fetchTransactions = async () => {
        try {
            const response = await fetch(`${API_URL}/api/transactions`);
            if (!response.ok) throw new Error('Failed to fetch transactions');
            const data = await response.json();
            setTransactions(data);
        } catch (err) {
            console.error(err);
            alert('Could not load transaction data.');
        }
    };

    // --- Data Fetching on Load ---
    useEffect(() => {
        if (isAuthenticated) {
            setIsLoading(true);
            // Fetch all initial data from the backend once the user is logged in.
            Promise.all([
                fetch(`${API_URL}/api/transactions`),
                fetch(`${API_URL}/api/cost-centers`),
                fetch(`${API_URL}/api/mappings`),
            ])
            .then(responses => Promise.all(responses.map(res => {
                if (!res.ok) throw new Error('A network request failed');
                return res.json();
            })))
            .then(([transactionsData, costCentersData, mappingsData]) => {
                setTransactions(transactionsData);
                setCostCenters(costCentersData.map(cc => cc.name)); // Assuming API returns objects with a 'name' property
                setMappings(mappingsData);
            })
            .catch(err => {
                console.error("Failed to fetch initial data:", err);
                alert("Failed to connect to the server. Please check your connection and try again.");
            })
            .finally(() => setIsLoading(false));
        }
    }, [isAuthenticated]);


    // --- Handlers ---

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            // The key change: We await the JSON response regardless of the status.
            const result = await response.json();

            if (result.success) {
                setIsAuthenticated(true);
            } else {
                // Display the specific error message from the backend
                setError(result.message);
            }
        } catch (loginError) {
            // This catch block now only handles network errors or JSON parsing issues
            setError('Server error. Please try again later.');
            console.error('Login failed:', loginError);
        }
    };

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'File upload failed on the server.');
            }

            alert('File uploaded and processed successfully!');
            await fetchTransactions(); // Re-fetch transactions to show new data
            setIsImportModalOpen(false);

        } catch (uploadError) {
            console.error('Error uploading file:', uploadError);
            alert(`File upload failed: ${uploadError.message}`); 
        }
    };
    
    const handleCostCenterChange = async (transactionId, newCostCenter) => {
        // Optimistically update the UI
        const originalTransactions = [...transactions];
        const newStatus = newCostCenter ? 'Processed' : 'Review Required';
        setTransactions(transactions.map(t => 
            t.id === transactionId ? { ...t, costCenter: newCostCenter, status: newStatus } : t
        ));

        try {
             await fetch(`${API_URL}/api/transactions/${transactionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ costCenter: newCostCenter }),
            });
        } catch (error) {
            console.error('Failed to update transaction:', error);
            alert('Failed to save change. Reverting.');
            setTransactions(originalTransactions); // Revert on failure
        }
    };
    
    const handleAddCostCenter = async () => {
        if (!newCostCenter || costCenters.includes(newCostCenter)) return;
        
        try {
            const response = await fetch(`${API_URL}/api/cost-centers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCostCenter }),
            });
            if (!response.ok) throw new Error('Failed to add cost center');
            
            setCostCenters([...costCenters, newCostCenter]);
            setNewCostCenter('');
        } catch (error) {
            console.error('Error adding cost center:', error);
            alert('Could not add cost center.');
        }
    };

    const handleRemoveCostCenter = async (centerToRemove) => {
        try {
            const response = await fetch(`${API_URL}/api/cost-centers/${encodeURIComponent(centerToRemove)}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to remove cost center');

            setCostCenters(costCenters.filter(c => c !== centerToRemove));
        } catch (error) {
            console.error('Error removing cost center:', error);
            alert('Could not remove cost center. It may be in use.');
        }
    };
    
    const handleAddMapping = async () => {
        if (!newMappingName) return;

        try {
            const response = await fetch(`${API_URL}/api/mappings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newMappingName, fileType: 'CSV' }),
            });
            if (!response.ok) throw new Error('Failed to add mapping');

            const newlyAddedMapping = await response.json();
            setMappings([...mappings, newlyAddedMapping]);
            setNewMappingName('');
        } catch (error) {
             console.error('Error adding mapping:', error);
            alert('Could not add mapping.');
        }
    };

    const handleRemoveMapping = async (idToRemove) => {
        try {
            const response = await fetch(`${API_URL}/api/mappings/${idToRemove}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to remove mapping');

            setMappings(mappings.filter(m => m.id !== idToRemove));
        } catch (error) {
            console.error('Error removing mapping:', error);
            alert('Could not remove mapping.');
        }
    };

    const handleExportCSV = () => {
        if (filteredTransactions.length === 0) {
            alert("No data to export.");
            return;
        }
        const headers = ["Date", "Merchant", "Amount", "Cost Center", "Status", "Account"];
        const rows = filteredTransactions.map(t => 
            [t.date, `"${t.merchant.replace(/"/g, '""')}"`, t.amount, t.costCenter, t.status, t.account].join(',')
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "balanzia_transactions.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Memoized Calculations ---
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start && transactionDate < start) return false;
            if (end && transactionDate > end) return false;
            if (filterMerchant && !t.merchant.toLowerCase().includes(filterMerchant.toLowerCase())) return false;
            if (filterAccount && t.account !== filterAccount) return false;
            if (filterCostCenter && t.costCenter !== filterCostCenter) return false;
            if (filterStatus && t.status !== filterStatus) return false;
            
            return true;
        });
    }, [transactions, startDate, endDate, filterMerchant, filterAccount, filterCostCenter, filterStatus]);


    const { totalIncome, totalExpenses } = useMemo(() => {
        return filteredTransactions.reduce((acc, t) => {
            if (t.amount > 0) {
                acc.totalIncome += t.amount;
            } else {
                acc.totalExpenses += t.amount;
            }
            return acc;
        }, { totalIncome: 0, totalExpenses: 0 });
    }, [filteredTransactions]);

    const netSavings = totalIncome + totalExpenses;
    const uniqueAccounts = useMemo(() => [...new Set(transactions.map(t => t.account))], [transactions]);


    // --- Render Logic ---

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f3e7c5] font-sans">
                <div className="w-full max-w-md p-8 space-y-8 bg-[#fffefa] rounded-lg shadow-lg">
                    <div className="text-center">
                        <img src="/farlish-logo.png" alt="balanzia logo" className="w-24 h-24 mx-auto mb-4" />
                        <h1 className="text-3xl font-bold text-[#111a39]">balanzia</h1>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="password" className="text-sm font-medium text-[#111a39]">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#99804e]"
                                placeholder="Enter your password"
                            />
                        </div>
                        {error && <p className="text-sm text-center text-red-500">{error}</p>}
                        <button type="submit" className="w-full py-2 text-white bg-[#111a39] rounded-md hover:bg-[#0a2152] transition-colors">
                            Sign In
                        </button>
                    </form>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-[#f3e7c5] text-[#111a39] font-sans">
            <header className="bg-[#fffefa] shadow-md">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <img className="h-10 w-auto" src="/farlish-logo.png" alt="balanzia logo" />
                            <h1 className="text-xl font-bold">balanzia</h1>
                        </div>
                        <div className="flex items-center space-x-2">
                             <button onClick={() => setIsManageMappingsModalOpen(true)} className="px-4 py-2 text-sm font-medium text-white bg-[#897142] rounded-md hover:bg-[#99804e] transition">Manage Mappings</button>
                             <button onClick={() => setIsManageCostCenterModalOpen(true)} className="px-4 py-2 text-sm font-medium text-white bg-[#897142] rounded-md hover:bg-[#99804e] transition">Manage Cost Centers</button>
                             <button onClick={handleExportCSV} className="px-4 py-2 text-sm font-medium text-white bg-[#897142] rounded-md hover:bg-[#99804e] transition">Export</button>
                             <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-2 text-sm font-medium text-white bg-[#111a39] rounded-md hover:bg-[#0a2152] transition">Import</button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="p-6 bg-[#fffefa] rounded-lg shadow-md flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Income</p>
                            <p className="text-2xl font-bold text-green-600">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-3xl text-[#99804e] opacity-50">$</div>
                    </div>
                    <div className="p-6 bg-[#fffefa] rounded-lg shadow-md flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                            <p className="text-2xl font-bold text-red-600">${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <svg className="w-8 h-8 text-[#99804e] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                    </div>
                    <div className="p-6 bg-[#fffefa] rounded-lg shadow-md flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Net Savings</p>
                            <p className="text-2xl font-bold">${netSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <svg className="w-8 h-8 text-[#99804e] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                    </div>
                </div>
                
                <div className="mt-8 bg-[#fffefa] rounded-lg shadow-md">
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                            <h2 className="text-lg font-bold mb-4 sm:mb-0">Recent Transactions</h2>
                            <div className="flex items-center space-x-4 text-sm">
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="start-date">From:</label>
                                    <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1 border rounded-md bg-gray-100" />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="end-date">To:</label>
                                    <input type="date" id="end-date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="p-1 border rounded-md bg-gray-100" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                            <input type="text" placeholder="Filter by Merchant..." value={filterMerchant} onChange={e => setFilterMerchant(e.target.value)} className="p-2 border rounded-md bg-gray-100" />
                            <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className="p-2 border rounded-md bg-gray-100">
                                <option value="">All Accounts</option>
                                {uniqueAccounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                            </select>
                             <select value={filterCostCenter} onChange={e => setFilterCostCenter(e.target.value)} className="p-2 border rounded-md bg-gray-100">
                                <option value="">All Cost Centers</option>
                                {costCenters.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                            </select>
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="p-2 border rounded-md bg-gray-100">
                                <option value="">All Statuses</option>
                                <option value="Processed">Processed</option>
                                <option value="Review Required">Review Required</option>
                            </select>
                        </div>


                        <div className="overflow-x-auto mt-4">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Center</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-10 text-gray-500">Connecting to server...</td>
                                        </tr>
                                    ) : filteredTransactions.length > 0 ? (
                                        filteredTransactions.map((transaction) => (
                                            <tr key={transaction.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(transaction.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{transaction.merchant}</td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <select
                                                        value={transaction.costCenter || ''}
                                                        onChange={(e) => handleCostCenterChange(transaction.id, e.target.value)}
                                                        className="p-1 border rounded-md bg-gray-100 focus:outline-none focus:ring-1 focus:ring-[#99804e]"
                                                    >
                                                        <option value="">Select...</option>
                                                        {costCenters.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${transaction.status === 'Processed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {transaction.status === 'Review Required' && <span className="mr-1.5">&#9888;</span>}
                                                        {transaction.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{transaction.account}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center py-10 text-gray-500">
                                                No transactions found. Try adjusting filters or importing a file.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

             {/* Modals */}
             {isManageCostCenterModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Manage Cost Centers</h3>
                        <div className="space-y-4">
                            <div className="flex space-x-2">
                                <input 
                                    type="text" 
                                    value={newCostCenter}
                                    onChange={(e) => setNewCostCenter(e.target.value)}
                                    placeholder="New cost center name"
                                    className="flex-grow p-2 border rounded-md bg-gray-100"
                                />
                                <button onClick={handleAddCostCenter} className="px-4 py-2 text-white bg-[#111a39] rounded-md hover:bg-[#0a2152]">Add</button>
                            </div>
                            <ul className="space-y-2 max-h-60 overflow-y-auto">
                                {costCenters.map(center => (
                                    <li key={center} className="flex justify-between items-center p-2 bg-gray-100 rounded-md">
                                        <span>{center}</span>
                                        <button onClick={() => handleRemoveCostCenter(center)} className="text-red-500 hover:text-red-700 font-bold">X</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="text-right mt-6">
                            <button onClick={() => setIsManageCostCenterModalOpen(false)} className="px-4 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300">Close</button>
                        </div>
                    </div>
                </div>
             )}

            {isManageMappingsModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                     <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-lg font-bold mb-4">Manage Mappings</h3>
                        <div className="space-y-4">
                            <div className="flex space-x-2">
                                <input 
                                    type="text" 
                                    value={newMappingName}
                                    onChange={(e) => setNewMappingName(e.target.value)}
                                    placeholder="New mapping template name"
                                    className="flex-grow p-2 border rounded-md bg-gray-100"
                                />
                                <button onClick={handleAddMapping} className="px-4 py-2 text-white bg-[#111a39] rounded-md hover:bg-[#0a2152]">Add</button>
                            </div>
                             <ul className="space-y-2 max-h-60 overflow-y-auto">
                                {mappings.map(mapping => (
                                    <li key={mapping.id} className="flex justify-between items-center p-2 bg-gray-100 rounded-md">
                                        <div>
                                            <span className="font-semibold">{mapping.name}</span>
                                            <span className="text-xs text-gray-500 ml-2">({mapping.fileType}, Created: {new Date(mapping.dateCreated).toLocaleDateString()})</span>
                                        </div>
                                        <button onClick={() => handleRemoveMapping(mapping.id)} className="text-red-500 hover:text-red-700 font-bold">X</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="text-right mt-6">
                            <button onClick={() => setIsManageMappingsModalOpen(false)} className="px-4 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300">Close</button>
                        </div>
                    </div>
                </div>
            )}
            
            {isImportModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md text-center">
                        <h3 className="text-lg font-bold mb-4">Import Transactions</h3>
                        <p className="text-gray-600 mb-6">Select a mapping template and upload your transaction file.</p>
                        <select className="w-full p-2 mb-4 border rounded-md bg-gray-100">
                             {mappings.length > 0 ? (
                                mappings.map(m => <option key={m.id} value={m.name}>{m.name}</option>)
                            ) : (
                                <option disabled>No mappings available</option>
                            )}
                        </select>
                        
                        <label htmlFor="file-upload" className="w-full cursor-pointer bg-[#111a39] text-white px-4 py-2 rounded-md hover:bg-[#0a2152] inline-block">
                           Choose File...
                        </label>
                        <input id="file-upload" type="file" className="hidden" onChange={handleFileSelect} accept=".csv,.xlsx,.xls,.ofx" />
                        
                        <div className="text-right mt-6">
                           <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300">Cancel</button>
                        </div>
                    </div>
                 </div>
            )}
        </div>
    );
}