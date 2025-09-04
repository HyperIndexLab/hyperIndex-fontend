import type { NextConfig } from "next";
import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter], // 支持 GitHub 风格 Markdown
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    BUILD_ENV: process.env.BUILD_ENV || 'production',
  },
  images: {
    remotePatterns: [
      {
        hostname: 'in-dex.4everland.store',
      },
    ],
  },
  eslint: {
    // ESLint 检查不会导致构建失败
    ignoreDuringBuilds: true,
  },
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'mdx'],
};

export default withMDX(nextConfig);
