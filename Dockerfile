# Use official Node.js LTS image
FROM node:20

# Install sendmail
RUN apt-get update && apt-get install -y sendmail && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Expose the application port
EXPOSE 3872

# Start the development server
CMD ["yarn", "start"]
