import { TestBed } from '@angular/core/testing';

import { WorkoutPlanServiceService } from './workout-plan-service.service';

describe('WorkoutPlanServiceService', () => {
  let service: WorkoutPlanServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkoutPlanServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
