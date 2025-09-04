export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  
  const post = await import(`@/markdown/${slug}.mdx`)
  const { default: PostContent } = post
  
  return (
    <div className="max-w-[800px] mx-auto px-6 py-12 markdown-content">
      {/* 可以在这里使用frontmatter数据 */}
      <h1>{post.title}</h1>
      {post.date && <p className="text-sm text-gray-500">{post.date}</p>}
      
      {/* 只渲染内容部分 */}
      <PostContent />
    </div>
  )
}
 
export function generateStaticParams() {
  return [{ slug: 'trade-competition' }, { slug: 'welcome' }]
}
 
export const dynamicParams = false