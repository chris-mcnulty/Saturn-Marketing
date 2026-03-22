import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import assetsRouter from "./assets";
import brandAssetsRouter from "./brandAssets";
import brandAssetCategoriesRouter from "./brandAssetCategories";
import campaignsRouter from "./campaigns";
import socialAccountsRouter from "./socialAccounts";
import tenantRouter from "./tenant";
import csvRouter from "./csv";
import adminRouter from "./admin";
import groundingDocsRouter from "./groundingDocs";
import emailGeneratorRouter from "./emailGenerator";
import extensionApiRouter from "./extensionApi";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(extensionApiRouter);
router.use(categoriesRouter);
router.use(assetsRouter);
router.use(brandAssetsRouter);
router.use(brandAssetCategoriesRouter);
router.use(campaignsRouter);
router.use(socialAccountsRouter);
router.use(tenantRouter);
router.use(csvRouter);
router.use(adminRouter);
router.use(groundingDocsRouter);
router.use(emailGeneratorRouter);

export default router;
