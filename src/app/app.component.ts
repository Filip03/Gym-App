import { Component, OnInit } from '@angular/core';
import { SupabaseService } from './services/supabase_service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
  constructor (private supabase: SupabaseService) {}
  
  async ngOnInit(){
      const { data, error } = await this.supabase.client
      .from('exercices')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Konekcija NE radi:', error.message);
    } else {
      console.log('Konekcija radi, primer podataka:', data);
    }
  }
}
