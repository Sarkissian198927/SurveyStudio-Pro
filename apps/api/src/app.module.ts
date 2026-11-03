import { AssetController,AssetService } from './assets';
import { ParticipantController,ParticipantService,InviteController } from './participants';
import { MaintenanceController,MaintenanceService } from './maintenance';
import { SyncService,SyncController } from './sync';
import { FeatureController,FeatureService,DeliveryController } from './features';
import { IdentityController,IdentityService } from './identity';
import { InfrastructureController } from './openapi';
import { OrganizationController, OrganizationService } from './organizations';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, AuthService, SessionGuard } from './auth';
import { Database } from './database';
import { ProjectController, ProjectService } from './projects';
import { SurveyController, SurveyService } from './surveys';
import { PublicController, PublicSurveyService } from './public';
@Module({
 imports:[JwtModule.register({secret:process.env.JWT_SECRET})],
 controllers:[AssetController,ParticipantController,InviteController,MaintenanceController,SyncController,FeatureController,DeliveryController,IdentityController,InfrastructureController,OrganizationController,AuthController,ProjectController,SurveyController,PublicController],
 providers:[AssetService,ParticipantService,MaintenanceService,SyncService,FeatureService,IdentityService,OrganizationService,Database,AuthService,ProjectService,SurveyService,PublicSurveyService,{provide:APP_GUARD,useClass:SessionGuard}]
})
export class AppModule {}
