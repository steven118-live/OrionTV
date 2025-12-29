//constants/BuildEnv.ts

export const BUILD_ENV = {
  USER_NAME: process.env.USER_NAME ?? "",
  REPO_NAME: process.env.REPO_NAME ?? "",
  BRANCH_NAME: process.env.BRANCH_NAME ?? "",
};