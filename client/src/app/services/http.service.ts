import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class HttpService {
  private client: HttpClient = inject(HttpClient);
  private baseUrl = 'http://localhost:3300/api';

  constructor() {}
  public registerUser(username: string, email: string, password: string) {
    return this.client
      .post(this.baseUrl + '/register', { username, email, password })
      .pipe(
        tap((res) => {
          console.log(res);
        })
      );
  }
  public loginUser(username: string, password: string) {
    return this.client.post('/api/login', { username, password });
  }
}
