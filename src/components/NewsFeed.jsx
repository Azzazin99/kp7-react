import React, { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle } from 'lucide-react';

const NewsFeed = () => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                // Adjust URL based on environment if needed, but relative path works if served from same origin
                // For local dev with proxy: /api/news
                // For Vercel: /api/news
                const res = await fetch('/api/news');
                if (!res.ok) throw new Error('Failed to fetch news');
                const data = await res.json();
                setNews(data);
            } catch (err) {
                console.error(err);
                setError('ไม่สามารถโหลดข้อมูลข่าวได้ในขณะนี้');
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []);

    if (loading) return (
        <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    );

    if (error) return (
        <div className="p-4 text-center text-red-500 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="mx-auto mb-2" />
            {error}
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden font-sans">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    <NewspaperIcon /> ข่าวประชาสัมพันธ์
                </h2>
                <span className="text-blue-100 text-sm bg-white/10 px-3 py-1 rounded-full">
                    {news.length} รายการ
                </span>
            </div>

            <div className="divide-y divide-gray-100">
                {news.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        ยังไม่มีข่าวประชาสัมพันธ์
                    </div>
                ) : (
                    news.map((item, index) => (
                        <div key={index} className="p-6 hover:bg-gray-50 transition duration-200 group">
                            <div className="flex flex-col md:flex-row gap-4">
                                {item.image && (
                                    <div className="md:w-1/4 shrink-0">
                                        <img
                                            src={item.image}
                                            alt={item.title}
                                            className="w-full h-32 object-cover rounded-lg shadow-sm group-hover:shadow-md transition"
                                            onError={(e) => e.target.style.display = 'none'}
                                        />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                        <Calendar size={14} />
                                        {formatDate(item.timestamp)}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition">
                                        {item.title}
                                    </h3>
                                    <p className="text-gray-600 text-sm line-clamp-2">
                                        {item.content}
                                    </p>
                                    <button className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1">
                                        อ่านเพิ่มเติม &rarr;
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// Helper Icon
const NewspaperIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" />
        <path d="M15 18h-5" />
        <path d="M10 6h8v4h-8V6Z" />
    </svg>
);

// Helper Date Formatter (Thai)
const formatDate = (ts) => {
    if (!ts) return '';
    // Check if it's already only date like "11/12/2568"
    if (ts.length <= 10) return ts;
    // If full timestamp, user might just want date
    const [datePart] = ts.split(' ');
    return datePart;
};

export default NewsFeed;
