import { query as q } from 'faunadb'

import NextAuth from "next-auth"
import providers from "next-auth/providers"

import { fauna } from '../../../services/fauna';

export default NextAuth({
  // Configure one or more authentication providers
  providers: [
    providers.GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      scope: 'read:user'
    }),
    // ...add more providers here
  ],
  callbacks: {
    async session(session) {
      try {
        const useActiveSubscription = await fauna.query(
          q.Get(
            q.Intersection([ 
              q.Match(
                q.Index('subscription_by_user_ref'),
                q.Select(
                  "ref",
                  q.Get(
                    q.Match(
                      q.Index('user_by_email'),
                      q.Casefold(session.user.email)
                    )
                  )
                )
              ),
              q.Match(
                q.Index('subscription_by_status'),
                "active"
              )
             ])
          )
        )
  
        return { 
          ...session,
          activeSubscription: useActiveSubscription
        }
      } catch {
        return { 
          ...session,
          activeSubscription: null,
        }
      }
    },
    async signIn({ user, account, profile, email, credentials }) {
      try {
        await fauna.query(
          q.If(
            q.Not(
              q.Exists(
                q.Match(
                  q.Index('user_by_email'),
                  q.Casefold(email)
                )
              )
            ),
            q.Create(
              q.Collection('users'),
              {data: {email}}
            ),
            q.Get(
              q.Match(
                q.Index('user_by_email'),
                q.Casefold(email)
              )
            )
          )
        )
        return true
      } catch {
        return false
      }
    },
  }
})