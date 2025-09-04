import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';
import { CalendarIcon } from '@heroicons/react/24/outline';

// 获取所有新闻文章
async function getNewsArticles() {
  // MDX 文件存储在上一级目录的 markdown 文件夹中
  const newsDirectory = path.join(process.cwd(), 'src/markdown');
  
  // 确保目录存在
  if (!fs.existsSync(newsDirectory)) {
    console.warn('新闻目录不存在:', newsDirectory);
    return [];
  }
  
  // 获取目录中的所有 .mdx 文件
  const fileNames = fs.readdirSync(newsDirectory).filter(file => file.endsWith('.mdx'));
  
  // 获取每个文件的内容和元数据
  const articles = fileNames.map(fileName => {
    // 从文件名创建 slug
    const slug = fileName.replace(/\.mdx$/, '');
    
    // 读取 MDX 文件内容
    const fullPath = path.join(newsDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    
    // 使用 gray-matter 解析文件的元数据部分
    const { data } = matter(fileContents);
    
    // 返回带有 slug 和元数据的对象
    return {
      slug,
      title: data.title,
      summary: data.summary,
      ...data,
      date: data.date ? new Date(data.date).toISOString().split('T')[0] : 'unknown date'
    };
  });
  
  // 按日期排序，最新的文章排在前面
  return articles.sort((a, b) => (a.date > b.date ? -1 : 1));
}

// 格式化日期
function formatDate(dateString: string) {
  if (dateString === 'unknown date') return 'Date unknown';
  
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  return new Date(dateString).toLocaleDateString('en-US', options);
}

export default async function NewsPage() {
  // 获取新闻文章
  const newsItems = await getNewsArticles();
  
  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      {/* 头部区域 */}
      <div className="mb-14 text-center">
        <h1 className="text-4xl font-bold mb-4 text-white">Latest News</h1>
        <p className="text-gray-400">Stay updated with the latest announcements, developments, and community news.</p>
      </div>
      
      {newsItems.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-400">No news articles yet</p>
        </div>
      ) : (
        <div className="space-y-10">
          {newsItems.map((news, index) => (
            <div key={news.slug} className="news-card">
              <Link 
                href={`/news/${news.slug}`}
                className={`block bg-[#171923] bg-opacity-80 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors ${
                  index === 0 ? 'p-8' : 'p-6'
                }`}
              >
                <div className="flex items-center text-sm text-gray-400 mb-4">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <time>{formatDate(news.date)}</time>
                </div>
                
                <h2 className={`font-semibold mb-4 text-white ${
                  index === 0 ? 'text-3xl' : 'text-2xl'
                }`}>
                  {news.title}
                </h2>
                
                {news.summary && (
                  <p className="text-gray-400 mb-5">
                    {news.summary}
                  </p>
                )}
                
                <div className="text-blue-500 hover:text-blue-400 transition-colors">
                  Read more
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
